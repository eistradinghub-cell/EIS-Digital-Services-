import { supabase } from "./supabase.js";

/* =========================================
   EIS TRADING HUB
   ADMIN DASHBOARD
========================================= */

const $ = (id) => document.getElementById(id);

let currentUser = null;
let currentProfile = null;

let applicationsCache = [];
let servicesCache = [];
let paymentsCache = [];

let realtimeChannel = null;
let isLoading = false;


/* =========================================
   HELPERS
========================================= */

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}


function formatCurrency(value) {
    return new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: "NGN",
        maximumFractionDigits: 2
    }).format(Number(value) || 0);
}


function formatDate(value) {
    if (!value) return "N/A";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "N/A";
    }

    return date.toLocaleString("en-NG", {
        dateStyle: "medium",
        timeStyle: "short"
    });
}


function showMessage(message, type = "info") {
    const box = $("admin-message");

    if (!box) return;

    box.textContent = message;
    box.className = `notice ${type}`;
    box.hidden = false;

    clearTimeout(showMessage.timer);

    showMessage.timer = setTimeout(() => {
        box.hidden = true;
    }, 6000);
}


function showEmpty(container, message) {
    if (!container) return;

    container.innerHTML = "";

    const element = document.createElement("div");

    element.className = "empty-state";
    element.textContent = message;

    container.appendChild(element);
}


function setLoading(container, message) {
    if (!container) return;

    container.innerHTML = "";

    const element = document.createElement("div");

    element.className = "loading";
    element.textContent = message;

    container.appendChild(element);
}


/* =========================================
   AUTHENTICATION
========================================= */

async function checkAdminSession() {
    try {
        const {
            data,
            error
        } = await supabase.auth.getSession();

        if (error) throw error;

        const session = data.session;

        if (!session) {
            window.location.replace("index.html");
            return false;
        }

        currentUser = session.user;

        return await verifyAdminRole();

    } catch (error) {
        console.error("Authentication error:", error);

        showMessage(
            "Unable to verify your session. Please log in again.",
            "error"
        );

        setTimeout(() => {
            window.location.replace("index.html");
        }, 2000);

        return false;
    }
}


/* =========================================
   ADMIN AUTHORIZATION
========================================= */

async function verifyAdminRole() {
    try {
        const {
            data,
            error
        } = await supabase
            .from("profiles")
            .select("id,email,full_name,role")
            .eq("id", currentUser.id)
            .single();

        if (error) throw error;

        currentProfile = data;

        const role = String(data.role || "").toLowerCase();

        if (!["admin", "super_admin"].includes(role)) {

            alert(
                "Access Denied. You are not an administrator."
            );

            await supabase.auth.signOut();

            window.location.replace("dashboard.html");

            return false;
        }

        $("admin-name").textContent =
            data.full_name || "Administrator";

        $("admin-email").textContent =
            data.email || currentUser.email || "";

        return true;

    } catch (error) {
        console.error("Admin verification error:", error);

        showMessage(
            "Unable to verify administrator permissions. Check your profile and database permissions.",
            "error"
        );

        return false;
    }
}


/* =========================================
   LOAD ADMIN DATA
========================================= */

async function loadAdminData() {
    if (isLoading) return;

    isLoading = true;

    try {
        await Promise.all([
            loadApplications(),
            loadServices(),
            loadPayments()
        ]);

    } finally {
        isLoading = false;
    }
}


/* =========================================
   APPLICATIONS
========================================= */

async function loadApplications() {
    const container = $("admin-apps-list");

    setLoading(container, "Loading applications...");

    try {
        /*
          We use the applications table directly.

          Customer names and email are read from
          the linked profile only when available.
        */

        const {
            data,
            error
        } = await supabase
            .from("applications")
            .select(`
                *,
                profiles (
                    full_name,
                    email
                )
            `)
            .order("created_at", {
                ascending: false
            });

        if (error) throw error;

        applicationsCache = data || [];

        updateApplicationStats();

        renderApplications();

    } catch (error) {
        console.error("Applications error:", error);

        showEmpty(
            container,
            "Unable to load applications. Check your database permissions and relationship settings."
        );
    }
}


/* =========================================
   APPLICATION STATISTICS
========================================= */

function updateApplicationStats() {
    const apps = applicationsCache;

    const review = apps.filter(app =>
        String(app.status || "").toLowerCase() === "in review"
    ).length;

    const completed = apps.filter(app =>
        String(app.status || "").toLowerCase() === "completed"
    ).length;

    $("stat-total").textContent = apps.length;

    $("stat-review").textContent = review;

    $("stat-completed").textContent = completed;
}


/* =========================================
   APPLICATION BORDER COLOR
========================================= */

function getStatusColor(status) {
    const value = String(status || "").toLowerCase();

    if (value === "completed") {
        return "var(--good)";
    }

    if (value === "rejected") {
        return "var(--bad)";
    }

    if (value === "in review") {
        return "var(--warn)";
    }

    return "var(--blue)";
}


/* =========================================
   APPLICATION RENDERING
========================================= */

function renderApplications() {
    const container = $("admin-apps-list");

    if (!container) return;

    container.innerHTML = "";

    if (!applicationsCache.length) {
        showEmpty(
            container,
            "No applications have been submitted yet."
        );

        return;
    }

    applicationsCache.forEach(app => {

        const profile = app.profiles || {};

        const name =
            profile.full_name ||
            "Customer";

        const email =
            profile.email ||
            "Not available";

        const formData =
            app.form_data || {};

        const phone =
            formData.phone ||
            "Not available";

        const service =
            app.service_name ||
            "Service";

        const amount =
            formatCurrency(app.amount);

        const status =
            app.status || "Pending";

        const borderColor =
            getStatusColor(status);

        const item = document.createElement("article");

        item.className = "app-item";

        item.style.borderLeftColor = borderColor;

        const heading = document.createElement("div");

        heading.className = "app-head";

        const title = document.createElement("div");

        const customerName = document.createElement("h3");

        customerName.textContent = name;

        const applicationId = document.createElement("p");

        applicationId.textContent =
            "Application ID: " + app.id;

        title.appendChild(customerName);
        title.appendChild(applicationId);

        const date = document.createElement("span");

        date.className = "app-date";

        date.textContent = formatDate(app.created_at);

        heading.appendChild(title);
        heading.appendChild(date);

        const details = document.createElement("div");

        details.className = "app-details";

        const detailItems = [
            ["Email", email],
            ["Phone", phone],
            ["Service", service],
            ["Amount", amount]
        ];

        detailItems.forEach(([label, value]) => {

            const detail = document.createElement("div");

            detail.className = "detail-item";

            const labelElement = document.createElement("span");

            labelElement.textContent = label;

            const valueElement = document.createElement("strong");

            valueElement.textContent = value;

            detail.appendChild(labelElement);
            detail.appendChild(valueElement);

            details.appendChild(detail);

        });

        const actions = document.createElement("div");

        actions.className = "app-actions";

        const currentStatus = document.createElement("span");

        currentStatus.textContent =
            "Current status: " + status;

        const select = document.createElement("select");

        select.className = "status-select";

        select.dataset.id = app.id;

        const statuses = [
            "In review",
            "In progress",
            "Completed",
            "Rejected"
        ];

        statuses.forEach(statusOption => {

            const option = document.createElement("option");

            option.value = statusOption;

            option.textContent = statusOption;

            if (
                String(status).toLowerCase() ===
                statusOption.toLowerCase()
            ) {
                option.selected = true;
            }

            select.appendChild(option);

        });

        select.addEventListener("change", handleStatusChange);

        actions.appendChild(currentStatus);
        actions.appendChild(select);

        item.appendChild(heading);
        item.appendChild(details);
        item.appendChild(actions);

        container.appendChild(item);

    });
}


/* =========================================
   UPDATE APPLICATION STATUS
========================================= */

async function handleStatusChange(event) {
    const select = event.currentTarget;

    const appId = select.dataset.id;

    const newStatus = select.value;

    const oldApp = applicationsCache.find(
        app => String(app.id) === String(appId)
    );

    if (!oldApp) return;

    const oldStatus = oldApp.status;

    select.disabled = true;

    try {
        const {
            error
        } = await supabase
            .from("applications")
            .update({
                status: newStatus
            })
            .eq("id", appId);

        if (error) throw error;

        showMessage(
            "Application status updated successfully.",
            "success"
        );

        await loadApplications();

    } catch (error) {
        console.error("Status update error:", error);

        select.value = oldStatus;

        showMessage(
            "Unable to update application status. Please check permissions.",
            "error"
        );

        select.disabled = false;
    }
}


/* =========================================
   SERVICES
========================================= */

async function loadServices() {
    const container = $("admin-services-list");

    setLoading(container, "Loading services...");

    try {
        const {
            data,
            error
        } = await supabase
            .from("services")
            .select("id,name,price")
            .order("name", {
                ascending: true
            });

        if (error) throw error;

        servicesCache = data || [];

        $("stat-products").textContent =
            servicesCache.length;

        renderServices();

    } catch (error) {
        console.error("Services error:", error);

        showEmpty(
            container,
            "Unable to load services. Check services table permissions."
        );
    }
}


function renderServices() {
    const container = $("admin-services-list");

    if (!container) return;

    container.innerHTML = "";

    if (!servicesCache.length) {
        showEmpty(
            container,
            "No services are currently registered."
        );

        return;
    }

    servicesCache.forEach(service => {

        const item = document.createElement("div");

        item.className = "admin-service-item";

        const info = document.createElement("div");

        const name = document.createElement("strong");

        name.textContent = service.name || "Unnamed service";

        const id = document.createElement("small");

        id.textContent = "Service ID: " + service.id;

        info.appendChild(name);
        info.appendChild(id);

        const price = document.createElement("strong");

        price.className = "admin-price";

        price.textContent = formatCurrency(service.price);

        item.appendChild(info);
        item.appendChild(price);

        container.appendChild(item);

    });
}


/* =========================================
   PAYMENTS
========================================= */

async function loadPayments() {
    const container = $("admin-payments-list");

    setLoading(container, "Loading payment records...");

    try {
        const {
            data,
            error
        } = await supabase
            .from("payments")
            .select("*")
            .order("created_at", {
                ascending: false
            });

        if (error) throw error;

        paymentsCache = data || [];

        renderPayments();

    } catch (error) {
        console.error("Payments error:", error);

        showEmpty(
            container,
            "Unable to load payment records. Check the payments table and permissions."
        );
    }
}


function renderPayments() {
    const container = $("admin-payments-list");

    if (!container) return;

    container.innerHTML = "";

    if (!paymentsCache.length) {
        showEmpty(
            container,
            "No payment records are currently available."
        );

        return;
    }

    paymentsCache.forEach(payment => {

        const item = document.createElement("div");

        item.className = "admin-payment-item";

        const info = document.createElement("div");

        const service = document.createElement("strong");

        service.textContent =
            payment.service_name || "Payment";

        const reference = document.createElement("small");

        reference.textContent =
            "Reference: " +
            (payment.reference || payment.ref || "N/A");

        const date = document.createElement("small");

        date.textContent =
            "Date: " + formatDate(payment.created_at);

        info.appendChild(service);
        info.appendChild(reference);
        info.appendChild(date);

        const amount = document.createElement("strong");

        amount.className = "admin-price";

        amount.textContent =
            formatCurrency(payment.amount);

        item.appendChild(info);
        item.appendChild(amount);

        container.appendChild(item);

    });
}


/* =========================================
   REFRESH BUTTONS
========================================= */

function initializeRefreshButtons() {

    $("refresh-applications")?.addEventListener(
        "click",
        loadApplications
    );

    $("refresh-services")?.addEventListener(
        "click",
        loadServices
    );

    $("refresh-payments")?.addEventListener(
        "click",
        loadPayments
    );

}


/* =========================================
   LOGOUT
========================================= */

async function logoutAdmin() {

    const button = $("nav-logout");

    if (button) {
        button.disabled = true;
        button.textContent = "Logging out...";
    }

    try {
        if (realtimeChannel) {
            await supabase.removeChannel(realtimeChannel);
            realtimeChannel = null;
        }

        const {
            error
        } = await supabase.auth.signOut();

        if (error) throw error;

        window.location.replace("index.html");

    } catch (error) {
        console.error("Logout error:", error);

        showMessage(
            "Unable to log out. Please try again.",
            "error"
        );

        if (button) {
            button.disabled = false;
            button.textContent = "Log out";
        }
    }
}


/* =========================================
   REALTIME
========================================= */

function initializeRealtime() {

    if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
    }

    realtimeChannel = supabase
        .channel("eis-admin-live-updates")

        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "applications"
            },
            async () => {
                await loadApplications();
            }
        )

        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "services"
            },
            async () => {
                await loadServices();
            }
        )

        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "payments"
            },
            async () => {
                await loadPayments();
            }
        )

        .subscribe((status) => {

            if (status === "SUBSCRIBED") {
                console.log("EIS Admin Realtime connected.");
            }

            if (status === "CHANNEL_ERROR") {
                console.error("Realtime channel error.");
            }

        });

}


/* =========================================
   AUTH STATE LISTENER
========================================= */

function initializeAuthListener() {

    supabase.auth.onAuthStateChange(
        (event, session) => {

            if (
                event === "SIGNED_OUT" ||
                !session
            ) {
                window.location.replace("index.html");
            }

        }
    );

}


/* =========================================
   INITIALIZATION
========================================= */

async function initializeAdminDashboard() {

    console.log("EIS Admin Dashboard initializing...");

    const authorized = await checkAdminSession();

    if (!authorized) return;

    initializeRefreshButtons();

    $("nav-logout")?.addEventListener(
        "click",
        logoutAdmin
    );

    initializeAuthListener();

    await loadAdminData();

    initializeRealtime();

    console.log("EIS Admin Dashboard ready.");

}


/* =========================================
   START APPLICATION
========================================= */

document.addEventListener(
    "DOMContentLoaded",
    initializeAdminDashboard
);


/* =========================================
   GLOBAL EXPORTS
========================================= */

window.EISAdmin = {
    loadAdminData,
    loadApplications,
    loadServices,
    loadPayments,
    logoutAdmin
};
