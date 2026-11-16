/* =====================================================
   EIS DIGITAL SERVICES
   CUSTOMER DASHBOARD
   DEMO PAYMENT VERSION
===================================================== */

import { supabase } from "./supabase.js";

let currentUser = null;
let currentProfile = null;
let selectedService = null;
let servicesCache = [];
let applicationsCache = [];
let notificationsCache = [];
let demoPaymentCompleted = false;

const $ = (id) => document.getElementById(id);
const DRAFT_PREFIX = "eis_application_draft_";

/* =====================================================
   MESSAGE SYSTEM
===================================================== */

function showMessage(message, type = "info", targetId = "pay-msg") {
    const box = $(targetId);
    if (!box) return;

    box.textContent = message;
    box.className = `msg ${type}`;
    box.style.display = "block";
}

/* =====================================================
   FORMAT FUNCTIONS
===================================================== */

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

/* =====================================================
   DEMO REFERENCE ID
   EIS- + EXACTLY 9 CHARACTERS
===================================================== */

function generateDemoReference() {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";

    const values = new Uint8Array(9);
    crypto.getRandomValues(values);

    for (let i = 0; i < 9; i++) {
        result += characters[values[i] % characters.length];
    }

    return `EIS-${result}`;
}

/* =====================================================
   FORM CLEANUP
   The form now matches the required application fields.
===================================================== */

function cleanApplicationForm() {
    /*
      The updated form includes the KEGOW, BVN, bank, address
      and date of birth fields, so no field removal is needed.
      Only the alternative phone field is set as optional.
    */

    const alternativePhone = $("f-altPhone");

    if (alternativePhone) {
        alternativePhone.required = false;
    }
}

/* =====================================================
   APPLICATION DRAFT
===================================================== */

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
            version: 4,
            service_id: selectedService.id,
            form_open: demoPaymentCompleted,
            saved_at: new Date().toISOString()
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

function restoreApplicationDraft() {
    const key = getDraftKey();
    if (!key) return;

    try {
        const stored = localStorage.getItem(key);
        if (!stored) return;

        const draft = JSON.parse(stored);

        if (!draft || draft.version !== 4) {
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

        const paySection = $("pay-section");
        const form = $("app-form");

        if (paySection) paySection.style.display = "block";

        if (draft.form_open === true) {
            demoPaymentCompleted = true;
            showDemoPaymentResult(true, generateDemoReference(), true);

            if (form) form.style.display = "block";

            showMessage(
                "Your selected service was restored. This is a demo session, not proof of payment.",
                "info",
                "form-msg"
            );
        } else {
            demoPaymentCompleted = false;
            renderDemoPaymentScreen();
        }

    } catch (error) {
        console.error("Draft restoration error:", error);
        clearApplicationDraft();
    }
}

/* =====================================================
   AUTHENTICATION
===================================================== */

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

/* =====================================================
   USER PROFILE
===================================================== */

async function loadUserProfile() {
    if (!currentUser) return;

    const welcome = $("welcome");
    const adminButton = $("nav-admin");

    if (adminButton) adminButton.style.display = "none";

    try {
        const { data, error } = await supabase
            .from("profiles")
            .select("id,full_name,email,phone,role")
            .eq("id", currentUser.id)
            .maybeSingle();

        if (error) throw error;

        currentProfile = data || null;

        const fullName = String(data?.full_name || "").trim();

        const firstName = fullName
            ? fullName.split(/\s+/)[0]
            : (
                currentUser.user_metadata?.full_name ||
                currentUser.email?.split("@")[0] ||
                "Customer"
            );

        if (welcome) {
            welcome.textContent = `Welcome back, ${firstName}`;
        }

        const role = String(data?.role || "").toLowerCase();

        if (
            ["admin", "super_admin"].includes(role) &&
            adminButton
        ) {
            adminButton.style.display = "inline-flex";
        }

    } catch (error) {
        console.error("Profile loading error:", error);

        if (welcome) {
            welcome.textContent = "Welcome back, Customer";
        }
    }
}

/* =====================================================
   SERVICE DESCRIPTION
===================================================== */

function getServiceDescription(serviceName) {
    const name = String(serviceName || "").toLowerCase();

    if (name.includes("android") && name.includes("bvn")) {
        return "Review the service information and contact support for details about the authorized provider and secure verification process.";
    }

    if (name.includes("combo") && name.includes("bvn")) {
        return "Review the service details and contact support for information about the authorized provider.";
    }

    return "Review the service information and displayed price. Contact support if you need assistance.";
}

/* =====================================================
   LOAD SERVICES
===================================================== */

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
            description.textContent =
                getServiceDescription(service.name);

            const price = document.createElement("p");
            price.className = "service-price";
            price.textContent = formatCurrency(service.price);

            const button = document.createElement("button");
            button.type = "button";
            button.className = "btn btn-primary";
            button.textContent = "View Service";

            button.addEventListener("click", () => {
                selectService(service);
            });

            card.append(title, description, price, button);
            container.appendChild(card);
        });

    } catch (error) {
        console.error("Services loading error:", error);
        container.textContent =
            "Unable to load services. Please try again.";
    }
}

/* =====================================================
   SELECT SERVICE
===================================================== */

function selectService(service) {
    if (!service) return;

    if (
        selectedService &&
        String(selectedService.id) !== String(service.id)
    ) {
        clearApplicationDraft();

        const form = $("app-form");
        if (form) form.reset();
    }

    selectedService = service;
    demoPaymentCompleted = false;

    const paySection = $("pay-section");
    const form = $("app-form");

    if (paySection) paySection.style.display = "block";
    if (form) form.style.display = "none";

    saveApplicationDraft();
    renderDemoPaymentScreen();

    paySection?.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });
}

/* =====================================================
   DEMO PAYMENT SCREEN
===================================================== */

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

            <h4 style="margin:0 0 12px;color:#1246a0;font-size:17px;">
                ${escapeHTML(selectedService.name || "Service")}
            </h4>

            <p style="margin:0;color:#627795;font-size:12px;">
                DEMO AMOUNT
            </p>

            <strong style="display:block;margin-top:5px;color:#1246a0;font-size:23px;">
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
        if (panel) panel.style.display = "block";

        $("btn-pay").disabled = true;
        $("btn-pay").textContent = "Demo Payment Options Opened";
    });

    $("demo-success")?.addEventListener("click", () => {
        const reference = generateDemoReference();
        showDemoPaymentResult(true, reference, false);
    });

    $("demo-failure")?.addEventListener("click", () => {
        const reference = generateDemoReference();
        showDemoPaymentResult(false, reference, false);
    });
}

/* =====================================================
   DEMO PAYMENT RESULT
===================================================== */

function showDemoPaymentResult(success, reference, restoring) {
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
                    The demo payment simulation was successful.
                    No actual payment was made or received.
                </p>

                <p style="font-size:12px;margin-bottom:5px;">
                    DEMO REFERENCE ID
                </p>

                <strong style="font-size:19px;letter-spacing:1px;">
                    ${reference}
                </strong>

                <p style="font-size:12px;margin-top:12px;">
                    Service: ${escapeHTML(selectedService?.name || "Service")}
                </p>

                <p style="font-size:12px;">
                    Demo amount: ${formatCurrency(selectedService?.price)}
                </p>

                <p style="font-size:11px;margin-top:12px;">
                    ${restoring ? "Restored demo session." : "Demo result generated now."}
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
                    This is a simulated failure for testing.
                    No money was charged or transferred.
                </p>

                <p style="font-size:12px;margin-bottom:5px;">
                    DEMO REFERENCE ID
                </p>

                <strong style="font-size:19px;letter-spacing:1px;">
                    ${reference}
                </strong>

                <p style="font-size:12px;margin-top:12px;">
                    Reason: Simulated test failure.
                </p>

                <button id="demo-try-again" type="button"
                    style="width:100%;padding:12px;margin-top:10px;border:0;border-radius:7px;background:#1456b8;color:white;font-weight:700;">
                    Try Again
                </button>
            </div>
        `;

        if (form) form.style.display = "none";

        $("demo-try-again")?.addEventListener("click", () => {
            renderDemoPaymentScreen();
        });
    }
}

/* =====================================================
   HTML ESCAPE
===================================================== */

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}

/* =====================================================
   FORM PREPARATION
===================================================== */

function prepareApplicationForm() {
    const states = [
        "Abia", "Adamawa", "Akwa Ibom", "Anambra",
        "Bauchi", "Bayelsa", "Benue", "Borno",
        "Cross River", "Delta", "Ebonyi", "Edo",
        "Ekiti", "Enugu", "FCT", "Gombe",
        "Imo", "Jigawa", "Kaduna", "Kano",
        "Katsina", "Kebbi", "Kogi", "Kwara",
        "Lagos", "Nasarawa", "Niger", "Ogun",
        "Ondo", "Osun", "Oyo", "Plateau",
        "Rivers", "Sokoto", "Taraba", "Yobe",
        "Zamfara"
    ];

    ["f-agentState", "f-stateRes"].forEach(id => {
        const select = $(id);
        if (!select) return;

        select.replaceChildren();

        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = "Select State";
        select.appendChild(placeholder);

        states.forEach(state => {
            const option = document.createElement("option");
            option.value = state;
            option.textContent = state;
            select.appendChild(option);
        });
    });
}

/* =====================================================
   APPLICATION FORM DATA
===================================================== */

function getApplicationFormData() {
    return {
        kegow_account: $("f-kegow")?.value.trim() || "",
        agent_location_state: $("f-agentState")?.value || "",
        bvn: $("f-bvn")?.value.trim() || "",
        bank_name: $("f-bankName")?.value.trim() || "",
        account_number: $("f-accountNo")?.value.trim() || "",
        account_name: $("f-accountName")?.value.trim() || "",
        first_name: $("f-firstName")?.value.trim() || "",
        middle_name: $("f-middleName")?.value.trim() || "",
        last_name: $("f-lastName")?.value.trim() || "",
        email: $("f-email")?.value.trim() || "",
        phone: $("f-phone")?.value.trim() || "",
        alternative_phone: $("f-altPhone")?.value.trim() || "",
        home_address: $("f-homeAddress")?.value.trim() || "",
        state_of_residence: $("f-stateRes")?.value || "",
        date_of_birth: $("f-dob")?.value || "",
        local_government: $("f-lga")?.value.trim() || "",
        geopolitical_zone: $("f-zone")?.value || ""
    };
}

/* =====================================================
   STATUS BADGE
===================================================== */

function createStatusBadge(status) {
    const badge = document.createElement("span");
    const value = String(status || "In review").trim();

    const normalized = value
        .toLowerCase()
        .replace(/\s+/g, "_");

    badge.className = `status-badge ${normalized}`;
    badge.textContent = value;

    return badge;
}

/* =====================================================
   LOAD APPLICATIONS
===================================================== */

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

        applicationsCache = data || [];

        if (!applicationsCache.length) {
            const row = document.createElement("tr");
            const cell = document.createElement("td");

            cell.colSpan = 5;
            cell.textContent = "No applications yet.";
            cell.style.textAlign = "center";

            row.appendChild(cell);
            container.appendChild(row);
            return;
        }

        applicationsCache.forEach(application => {
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

            row.append(name, reference, service, submitted, status);
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

/* =====================================================
   LOAD NOTIFICATIONS
===================================================== */

async function loadNotifications() {
    if (!currentUser) return;

    const list = $("notifications-list");
    const count = $("notification-count");

    if (list) list.textContent = "Loading notifications...";

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
            count.textContent = unread > 99 ? "99+" : String(unread);
            count.style.display = unread > 0 ? "flex" : "none";
        }

        renderNotifications();

    } catch (error) {
        console.error("Notifications loading error:", error);

        if (list) {
            list.textContent = "Unable to load notifications.";
        }
    }
}

/* =====================================================
   RENDER NOTIFICATIONS
===================================================== */

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

        if (!notification.is_read) {
            item.style.background = "#f1f7fb";
        }

        const title = document.createElement("strong");
        title.textContent = notification.title || "Notification";

        const message = document.createElement("p");
        message.textContent = notification.message || "";

        const time = document.createElement("time");
        time.textContent = formatDateTime(notification.created_at);

        item.append(title, message, time);
        list.appendChild(item);
    });
}

/* =====================================================
   MARK NOTIFICATIONS AS READ
===================================================== */

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

        const count = $("notification-count");

        if (count) {
            count.textContent = "";
            count.style.display = "none";
        }

        renderNotifications();

    } catch (error) {
        console.error("Mark notifications as read error:", error);
    }
}

/* =====================================================
   NOTIFICATION DROPDOWN
===================================================== */

function setupNotificationDropdown() {
    const button = $("notification-button");
    const dropdown = $("notification-dropdown");

    if (!button || !dropdown) return;

    button.setAttribute("aria-expanded", "false");

    button.addEventListener("click", async () => {
        const isOpen = dropdown.classList.toggle("open");

        button.setAttribute("aria-expanded", String(isOpen));

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
            button.setAttribute("aria-expanded", "false");
        }
    });
}

/* =====================================================
   SUBMIT APPLICATION
===================================================== */

async function submitApplication(event) {
    event.preventDefault();

    const form = $("app-form");

    if (!currentUser) {
        showMessage("Please log in first.", "err", "form-msg");
        return;
    }

    if (!selectedService) {
        showMessage("Please select a service first.", "err", "form-msg");
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
        !formData.kegow_account ||
        !formData.agent_location_state ||
        !formData.bvn ||
        !formData.bank_name ||
        !formData.account_number ||
        !formData.account_name ||
        !formData.first_name ||
        !formData.last_name ||
        !formData.email ||
        !formData.phone ||
        !formData.home_address ||
        !formData.state_of_residence ||
        !formData.date_of_birth ||
        !formData.local_government ||
        !formData.geopolitical_zone
    ) {
        showMessage(
            "Please complete all required fields.",
            "err",
            "form-msg"
        );
        return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(formData.email)) {
        showMessage(
            "Please enter a valid email address.",
            "err",
            "form-msg"
        );
        return;
    }

    const phoneDigits = formData.phone.replace(/\D/g, "");

    if (phoneDigits.length < 7 || phoneDigits.length > 15) {
        showMessage(
            "Please enter a valid phone number.",
            "err",
            "form-msg"
        );
        return;
    }

    const button = form?.querySelector('button[type="submit"]');

    if (button) {
        button.disabled = true;
        button.textContent = "Submitting...";
    }

    try {
        const safeFormData = {
            kegow_account: formData.kegow_account,
            agent_location_state: formData.agent_location_state,
            bvn: formData.bvn,
            bank_name: formData.bank_name,
            account_number: formData.account_number,
            account_name: formData.account_name,
            first_name: formData.first_name,
            middle_name: formData.middle_name,
            last_name: formData.last_name,
            email: formData.email,
            phone: formData.phone,
            alternative_phone: formData.alternative_phone,
            home_address: formData.home_address,
            state_of_residence: formData.state_of_residence,
            date_of_birth: formData.date_of_birth,
            local_government: formData.local_government,
            geopolitical_zone: formData.geopolitical_zone
        };

        const { error } = await supabase
            .from("applications")
            .insert([{
                user_id: currentUser.id,
                service_name: selectedService.name,
                amount: Number(selectedService.price) || 0,
                status: "In review",
                form_data: safeFormData
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

        const paySection = $("pay-section");
        if (paySection) paySection.style.display = "none";

        await loadApplications();

    } catch (error) {
        console.error("Application submission error:", error);

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

/* =====================================================
   LOGOUT
===================================================== */

async function logoutUser() {
    try {
        const { error } = await supabase.auth.signOut();

        if (error) throw error;

        window.location.replace("index.html");

    } catch (error) {
        console.error("Logout error:", error);
        alert("Unable to log out. Please try again.");
    }
}

/* =====================================================
   INITIALIZE DASHBOARD
===================================================== */

async function initializeDashboard() {
    const authenticated = await checkUserSession();
    if (!authenticated) return;

    cleanApplicationForm();
    prepareApplicationForm();
    setupNotificationDropdown();

    const form = $("app-form");

    if (form) {
        form.addEventListener("submit", submitApplication);
        form.style.display = "none";
    }

    const logout = $("nav-logout");

    if (logout) {
        logout.addEventListener("click", logoutUser);
    }

    const paySection = $("pay-section");

    if (paySection) {
        paySection.style.display = "none";
    }

    await loadUserProfile();

    await Promise.all([
        loadServices(),
        loadApplications(),
        loadNotifications()
    ]);

    restoreApplicationDraft();
}

/* =====================================================
   AUTH STATE LISTENER
===================================================== */

supabase.auth.onAuthStateChange(event => {
    if (event === "SIGNED_OUT") {
        window.location.replace("index.html");
    }
});

/* =====================================================
   START DASHBOARD
===================================================== */

initializeDashboard();

/* =====================================================
   GLOBAL FUNCTIONS
===================================================== */

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
