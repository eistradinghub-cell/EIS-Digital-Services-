import { supabase } from "./supabase.js";

let currentUser = null;
let currentProfile = null;
let selectedService = null;
let servicesCache = [];
let notificationsCache = [];
let demoPaymentCompleted = false;

const $ = id => document.getElementById(id);
const DRAFT_PREFIX = "eis_application_draft_";

function showMessage(message, type = "info", targetId = "pay-msg") {
    const box = $(targetId);
    if (!box) return;

    box.textContent = message;
    box.className = `msg ${type}`;
    box.style.display = "block";
}

function formatCurrency(amount) {
    return new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: "NGN",
        maximumFractionDigits: 2
    }).format(Number(amount) || 0);
}

function formatDate(date) {
    if (!date) return "N/A";

    const value = new Date(date);
    if (Number.isNaN(value.getTime())) return "N/A";

    return value.toLocaleDateString("en-NG", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

function formatDateTime(date) {
    if (!date) return "";

    const value = new Date(date);
    if (Number.isNaN(value.getTime())) return "";

    return value.toLocaleString("en-NG", {
        dateStyle: "medium",
        timeStyle: "short"
    });
}

function generateDemoReference() {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const values = new Uint8Array(9);

    crypto.getRandomValues(values);

    let result = "";

    for (let i = 0; i < 9; i++) {
        result += characters[values[i] % characters.length];
    }

    return `EIS-${result}`;
}

function getDraftKey() {
    return currentUser
        ? `${DRAFT_PREFIX}${currentUser.id}`
        : null;
}

function saveApplicationDraft() {
    const key = getDraftKey();

    if (!key || !selectedService) return;

    try {
        localStorage.setItem(key, JSON.stringify({
            version: 6,
            service_id: selectedService.id,
            form_open: demoPaymentCompleted
        }));
    } catch (error) {
        console.error("Draft saving error:", error);
    }
}

function clearApplicationDraft() {
    const key = getDraftKey();

    if (!key) return;

    try {
        localStorage.removeItem(key);
    } catch (error) {
        console.error("Draft clearing error:", error);
    }
}

async function checkUserSession() {
    try {
        const {
            data: { user },
            error
        } = await supabase.auth.getUser();

        if (error) throw error;

        if (!user) {
            window.location.replace("index.html");
            return false;
        }

        currentUser = user;
        return true;

    } catch (error) {
        console.error("Authentication error:", error);

        window.location.replace("index.html");
        return false;
    }
}

/* =========================================
   CUSTOMER WELCOME CARD DESIGN
   Clean white surface with a subtle blue tint.
========================================= */

function applyDashboardWelcomeStyle() {
    if (document.getElementById("eis-dashboard-welcome-style")) {
        return;
    }

    const style = document.createElement("style");
    style.id = "eis-dashboard-welcome-style";
    style.textContent = `
        .dashboard-page .dashboard-intro {
            background: linear-gradient(
                135deg,
                #ffffff 0%,
                #fbfdff 58%,
                #edf4ff 100%
            ) !important;
            border: 1px solid #dce8f8 !important;
            box-shadow: 0 8px 24px rgba(34, 83, 145, 0.08) !important;
        }

        .dashboard-page .dashboard-intro h1 {
            color: #174b91 !important;
        }

        .dashboard-page .dashboard-intro p {
            color: #647c9b !important;
        }
    `;

    document.head.appendChild(style);
}


/* =========================================
   USER PROFILE AND ADMIN NAVIGATION
========================================= */

async function loadUserProfile() {
    applyDashboardWelcomeStyle();
    if (!currentUser) return;

    const welcome = $("welcome");
    const adminButton = $("nav-admin");

    // Hide Admin Panel until the user's role is verified.
    if (adminButton) {
        adminButton.hidden = true;
        adminButton.classList.remove("is-admin-nav");
    }

    try {
        const { data, error } = await supabase
            .from("profiles")
            .select("id,full_name,email,phone,role")
            .eq("id", currentUser.id)
            .maybeSingle();

        if (error) throw error;

        currentProfile = data || null;

        const profileName = String(data?.full_name || "").trim();
        const metadataName = String(
            currentUser.user_metadata?.full_name ||
            currentUser.user_metadata?.name ||
            ""
        ).trim();

        // Use the complete name saved when the customer registered.
        const displayName =
            profileName ||
            metadataName ||
            currentUser.email?.split("@")[0] ||
            "Customer";

        if (welcome) {
            welcome.textContent = `Welcome back, ${displayName}`;
        }

        const role = String(data?.role || "")
            .trim()
            .toLowerCase();

        // Only verified administrators can see this button.
        if (
            ["admin", "super_admin"].includes(role) &&
            adminButton
        ) {
            adminButton.hidden = false;
            adminButton.classList.add("is-admin-nav");
        }

    } catch (error) {
        console.error("Profile loading error:", error);

        if (welcome) {
            const fallbackName = String(
                currentUser?.user_metadata?.full_name ||
                currentUser?.user_metadata?.name ||
                currentUser?.email?.split("@")[0] ||
                "Customer"
            ).trim();

            welcome.textContent = `Welcome back, ${fallbackName}`;
        }

        if (adminButton) {
            adminButton.hidden = true;
            adminButton.classList.remove("is-admin-nav");
        }
    }
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}

function getServiceDescription() {
    return "Review the service information and displayed price. Contact support if you need assistance.";
}

async function loadServices() {
    const container = $("services-container");

    if (!container) return;

    container.textContent = "Loading services...";

    try {
        const { data, error } = await supabase
            .from("services")
            .select("id,name,price")
            .order("created_at", { ascending: false });

        if (error) throw error;

        servicesCache = data || [];

        container.replaceChildren();

        if (!servicesCache.length) {
            container.textContent =
                "No services are available at the moment.";
            return;
        }

        servicesCache.forEach(service => {
            const card = document.createElement("article");
            card.className = "service-card";

            const title = document.createElement("h3");
            title.textContent = service.name || "Service";

            const description = document.createElement("div");
            description.className = "service-description";
            description.textContent = getServiceDescription();

            const price = document.createElement("p");
            price.textContent = formatCurrency(service.price);

            const button = document.createElement("button");
            button.type = "button";
            button.textContent = "View Service";

            button.addEventListener("click", () => {
                selectService(service);
            });

            card.append(
                title,
                description,
                price,
                button
            );

            container.appendChild(card);
        });

    } catch (error) {
        console.error("Services loading error:", error);

        container.textContent =
            "Unable to load services. Please try again.";
    }
}

function selectService(service) {
    if (!service) return;

    if (
        selectedService &&
        String(selectedService.id) !== String(service.id)
    ) {
        clearApplicationDraft();
        $("app-form")?.reset();
    }

    selectedService = service;
    demoPaymentCompleted = false;

    if ($("app-form")) {
        $("app-form").style.display = "none";
    }

    saveApplicationDraft();
    renderDemoPaymentScreen();

    $("pay-section")?.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });
}

function renderDemoPaymentScreen() {
    const section = $("pay-section");

    if (!section || !selectedService) return;

    section.style.display = "block";

    section.innerHTML = `
        <h3>Review Your Service</h3>

        <div style="
            background:#fff;
            border:1px solid #dce7f8;
            border-radius:9px;
            padding:16px;
            margin:14px 0;
        ">
            <p style="margin:0 0 8px;color:#627795;font-size:12px;">
                SELECTED SERVICE
            </p>

            <h4 style="margin:0 0 12px;color:#1769d2;font-size:17px;">
                ${escapeHTML(selectedService.name || "Service")}
            </h4>

            <p style="margin:0;color:#627795;font-size:12px;">
                DEMO AMOUNT
            </p>

            <strong style="display:block;margin-top:5px;color:#1769d2;font-size:23px;">
                ${formatCurrency(selectedService.price)}
            </strong>
        </div>

        <div class="demo">
            <strong>DEMO MODE:</strong>
            This is a demonstration only. No money will be charged,
            transferred or received. A demo reference ID is not proof of payment.
        </div>

        <button id="btn-pay" type="button"
            class="btn btn-primary"
            style="width:100%;min-height:45px;padding:12px;font-weight:700;">
            Continue to Demo Payment
        </button>

        <div id="demo-payment-panel" style="display:none;margin-top:16px;">
            <h3 style="font-size:17px;">Demo Payment Simulation</h3>

            <p style="color:#627795;font-size:13px;line-height:1.7;">
                Choose a test result below. These buttons do not connect
                to a bank or payment provider.
            </p>

            <button id="demo-success" type="button"
                style="width:100%;padding:13px;margin:5px 0;border:0;border-radius:7px;background:#18834a;color:white;font-weight:700;">
                Simulate Successful Payment
            </button>

            <button id="demo-failure" type="button"
                style="width:100%;padding:13px;margin:5px 0;border:0;border-radius:7px;background:#b83232;color:white;font-weight:700;">
                Simulate Failed Payment
            </button>
        </div>

        <div id="demo-result" aria-live="polite"></div>
    `;

    $("btn-pay")?.addEventListener("click", () => {
        const panel = $("demo-payment-panel");

        if (panel) {
            panel.style.display = "block";
        }

        const button = $("btn-pay");

        if (button) {
            button.disabled = true;
            button.textContent = "Demo Payment Options Opened";
        }
    });

    $("demo-success")?.addEventListener("click", () => {
        showDemoPaymentResult(
            true,
            generateDemoReference()
        );
    });

    $("demo-failure")?.addEventListener("click", () => {
        showDemoPaymentResult(
            false,
            generateDemoReference()
        );
    });
}

function showDemoPaymentResult(success, reference) {
    const result = $("demo-result");
    const form = $("app-form");

    if (!result) return;

    if (success) {
        demoPaymentCompleted = true;
        saveApplicationDraft();

        result.innerHTML = `
            <div style="
                margin-top:16px;
                padding:17px;
                border:1px solid #b8e1c8;
                border-radius:9px;
                background:#effaf3;
                color:#17683a;
            ">
                <h3 style="margin:0 0 10px;color:#17683a;">
                    ✓ Demo Payment Successful
                </h3>

                <p style="font-size:13px;line-height:1.7;">
                    This is a simulated result only. No actual payment was made or received.
                </p>

                <p style="font-size:12px;margin-bottom:5px;">
                    DEMO REFERENCE ID
                </p>

                <strong style="font-size:19px;letter-spacing:1px;">
                    ${escapeHTML(reference)}
                </strong>

                <p style="font-size:12px;margin-top:12px;">
                    Service: ${escapeHTML(selectedService?.name || "Service")}
                </p>

                <p style="font-size:12px;">
                    Demo amount: ${formatCurrency(selectedService?.price)}
                </p>

                <strong style="font-size:11px;">
                    NOT A REAL PAYMENT RECEIPT
                </strong>
            </div>
        `;

        if (form) {
            form.style.display = "block";

            form.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        }

        showMessage(
            "Demo successful. You may now complete the application form. No money was transferred.",
            "ok",
            "form-msg"
        );

    } else {
        demoPaymentCompleted = false;
        clearApplicationDraft();

        result.innerHTML = `
            <div style="
                margin-top:16px;
                padding:17px;
                border:1px solid #f0c5c5;
                border-radius:9px;
                background:#fff3f3;
                color:#a52d2d;
            ">
                <h3 style="margin:0 0 10px;color:#a52d2d;">
                    ✕ Demo Payment Failed
                </h3>

                <p style="font-size:13px;line-height:1.7;">
                    This is a simulated failure. No money was charged or transferred.
                </p>

                <p style="font-size:12px;margin-bottom:5px;">
                    DEMO REFERENCE ID
                </p>

                <strong style="font-size:19px;letter-spacing:1px;">
                    ${escapeHTML(reference)}
                </strong>

                <button id="demo-try-again" type="button"
                    style="
                        width:100%;
                        padding:12px;
                        margin-top:10px;
                        border:0;
                        border-radius:7px;
                        background:#1769d2;
                        color:white;
                        font-weight:700;
                    ">
                    Try Again
                </button>
            </div>
        `;

        if (form) {
            form.style.display = "none";
        }

        $("demo-try-again")?.addEventListener("click", () => {
            renderDemoPaymentScreen();
        });
    }
}

/*
 * SAFE APPLICATION DATA
 * Only basic contact details are collected.
 * Sensitive identity and financial information is not collected.
 */
function getApplicationFormData() {
    return {
        first_name: $("f-firstName")?.value.trim() || "",
        last_name: $("f-lastName")?.value.trim() || "",
        email: $("f-email")?.value.trim() || "",
        phone: $("f-phone")?.value.trim() || ""
    };
}

function createStatusBadge(status) {
    const badge = document.createElement("span");
    const value = String(status || "In review").trim();

    badge.className =
        `status-badge ${value.toLowerCase().replace(/\s+/g, "_")}`;

    badge.textContent = value;

    return badge;
}

async function loadApplications() {
    const container = $("apps-list");

    if (!currentUser || !container) return;

    container.replaceChildren();

    try {
        const { data, error } = await supabase
            .from("applications")
            .select("id,user_id,service_name,amount,status,created_at")
            .eq("user_id", currentUser.id)
            .order("created_at", { ascending: false });

        if (error) throw error;

        if (!data?.length) {
            const row = document.createElement("tr");
            const cell = document.createElement("td");

            cell.colSpan = 5;
            cell.textContent = "No applications yet.";
            cell.style.textAlign = "center";

            row.appendChild(cell);
            container.appendChild(row);

            return;
        }

        data.forEach(application => {
            const row = document.createElement("tr");

            const name = document.createElement("td");

            name.textContent =
                currentProfile?.full_name ||
                currentUser.email ||
                "Customer";

            const reference = document.createElement("td");

            reference.textContent =
                String(application.id).slice(0, 8).toUpperCase();

            const service = document.createElement("td");
            service.textContent =
                application.service_name || "Service";

            const submitted = document.createElement("td");
            submitted.textContent =
                formatDate(application.created_at);

            const status = document.createElement("td");
            status.appendChild(
                createStatusBadge(application.status)
            );

            row.append(
                name,
                reference,
                service,
                submitted,
                status
            );

            container.appendChild(row);
        });

    } catch (error) {
        console.error("Applications loading error:", error);

        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 5;
        cell.textContent = "Unable to load applications.";
        cell.style.textAlign = "center";

        row.appendChild(cell);
        container.appendChild(row);
    }
}

async function loadNotifications() {
    if (!currentUser) return;

    const list = $("notifications-list");
    const count = $("notification-count");

    if (list) {
        list.textContent = "Loading notifications...";
    }

    try {
        const { data, error } = await supabase
            .from("notifications")
            .select("id,user_id,title,message,is_read,created_at")
            .eq("user_id", currentUser.id)
            .order("created_at", { ascending: false })
            .limit(20);

        if (error) throw error;

        notificationsCache = data || [];

        const unread = notificationsCache.filter(
            item => !item.is_read
        ).length;

        if (count) {
            count.textContent =
                unread > 99 ? "99+" : String(unread);

            count.style.display =
                unread > 0 ? "flex" : "none";
        }

        renderNotifications();

    } catch (error) {
        console.error("Notifications loading error:", error);

        if (list) {
            list.textContent = "Unable to load notifications.";
        }
    }
}

function renderNotifications() {
    const list = $("notifications-list");

    if (!list) return;

    list.replaceChildren();

    if (!notificationsCache.length) {
        const empty = document.createElement("p");

        empty.textContent = "You have no notifications.";

        list.appendChild(empty);
        return;
    }

    notificationsCache.forEach(notification => {
        const item = document.createElement("div");
        item.className = "notification-item";

        const title = document.createElement("strong");
        title.textContent =
            notification.title || "Notification";

        const message = document.createElement("p");
        message.textContent =
            notification.message || "";

        const time = document.createElement("time");
        time.textContent =
            formatDateTime(notification.created_at);

        item.append(title, message, time);
        list.appendChild(item);
    });
}

async function markNotificationsAsRead() {
    if (!currentUser) return;

    const unreadIds = notificationsCache
        .filter(item => !item.is_read)
        .map(item => item.id);

    if (!unreadIds.length) return;

    try {
        const { error } = await supabase
            .from("notifications")
            .update({ is_read: true })
            .eq("user_id", currentUser.id)
            .in("id", unreadIds)
            .eq("is_read", false);

        if (error) throw error;

        notificationsCache = notificationsCache.map(item => ({
            ...item,
            is_read: true
        }));

        if ($("notification-count")) {
            $("notification-count").style.display = "none";
        }

        renderNotifications();

    } catch (error) {
        console.error(
            "Mark notifications as read error:",
            error
        );
    }
}

function setupNotificationDropdown() {
    const button = $("notification-button");
    const dropdown = $("notification-dropdown");

    if (!button || !dropdown) return;

    button.setAttribute("aria-expanded", "false");

    button.addEventListener("click", async () => {
        const isOpen = dropdown.classList.toggle("open");

        button.setAttribute(
            "aria-expanded",
            String(isOpen)
        );

        if (isOpen) {
            await markNotificationsAsRead();
        }
    });

    document.addEventListener("click", event => {
        if (
            !button.contains(event.target) &&
            !dropdown.contains(event.target)
        ) {
            dropdown.classList.remove("open");

            button.setAttribute(
                "aria-expanded",
                "false"
            );
        }
    });
}

async function submitApplication(event) {
    event.preventDefault();

    const form = $("app-form");

    if (!currentUser || !selectedService) {
        showMessage(
            "Please select a service first.",
            "err",
            "form-msg"
        );
        return;
    }

    if (!demoPaymentCompleted) {
        showMessage(
            "Please complete the demo step first.",
            "err",
            "form-msg"
        );
        return;
    }

    const formData = getApplicationFormData();

    if (
        !formData.first_name ||
        !formData.last_name ||
        !formData.email
    ) {
        showMessage(
            "Please enter your first name, last name and email address.",
            "err",
            "form-msg"
        );
        return;
    }

    const emailPattern =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(formData.email)) {
        showMessage(
            "Please enter a valid email address.",
            "err",
            "form-msg"
        );
        return;
    }

    if (formData.phone) {
        const phoneDigits =
            formData.phone.replace(/\D/g, "");

        if (
            phoneDigits.length < 7 ||
            phoneDigits.length > 15
        ) {
            showMessage(
                "Please enter a valid phone number.",
                "err",
                "form-msg"
            );
            return;
        }
    }

    const button = form?.querySelector(
        'button[type="submit"]'
    );

    if (button) {
        button.disabled = true;
        button.textContent = "Submitting...";
    }

    try {
        const { error } = await supabase
            .from("applications")
            .insert([{
                user_id: currentUser.id,
                service_name: selectedService.name,
                amount: Number(selectedService.price) || 0,
                status: "In review",
                form_data: formData
            }]);

        if (error) throw error;

        clearApplicationDraft();

        showMessage(
            "Your application has been submitted successfully.",
            "ok",
            "form-msg"
        );

        form.reset();
        form.style.display = "none";

        selectedService = null;
        demoPaymentCompleted = false;

        if ($("pay-section")) {
            $("pay-section").style.display = "none";
        }

        await loadApplications();

    } catch (error) {
        console.error(
            "Application submission error:",
            error
        );

        showMessage(
            error.message || "Submission failed. Please try again.",
            "err",
            "form-msg"
        );

    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = "Submit Application";
        }
    }
}

async function logoutUser() {
    try {
        const { error } =
            await supabase.auth.signOut();

        if (error) throw error;

        window.location.replace("index.html");

    } catch (error) {
        console.error("Logout error:", error);

        alert("Unable to log out. Please try again.");
    }
}

function restoreApplicationDraft() {
    const key = getDraftKey();

    if (!key) return;

    try {
        const stored = localStorage.getItem(key);

        if (!stored) return;

        const draft = JSON.parse(stored);

        if (!draft || draft.version !== 6) {
            clearApplicationDraft();
            return;
        }

        const service = servicesCache.find(item =>
            String(item.id) === String(draft.service_id)
        );

        if (!service) {
            clearApplicationDraft();
            return;
        }

        selectedService = service;

        if (draft.form_open === true) {
            renderDemoPaymentScreen();

            demoPaymentCompleted = true;

            showDemoPaymentResult(
                true,
                generateDemoReference()
            );

        } else {
            renderDemoPaymentScreen();
        }

    } catch (error) {
        console.error(
            "Draft restoration error:",
            error
        );

        clearApplicationDraft();
    }
}

async function initializeDashboard() {
    const authenticated =
        await checkUserSession();

    if (!authenticated) return;

    setupNotificationDropdown();

    const form = $("app-form");

    if (form) {
        form.addEventListener(
            "submit",
            submitApplication
        );

        form.style.display = "none";
    }

    $("nav-logout")?.addEventListener(
        "click",
        logoutUser
    );

    if ($("pay-section")) {
        $("pay-section").style.display = "none";
    }

    await loadUserProfile();

    await Promise.all([
        loadServices(),
        loadApplications(),
        loadNotifications()
    ]);

    restoreApplicationDraft();
}

supabase.auth.onAuthStateChange(event => {
    if (event === "SIGNED_OUT") {
        window.location.replace("index.html");
    }
});

initializeDashboard();

window.EISDashboard = {
    loadServices,
    loadApplications,
    loadNotifications,
    loadUserProfile,
    selectService,
    logoutUser,
    saveApplicationDraft,
    clearApplicationDraft,
    formatCurrency,
    formatDate,
    generateDemoReference
};
