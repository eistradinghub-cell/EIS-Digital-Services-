import { supabase } from "./supabase.js";

/* =========================================
   EIS TRADING HUB
   ADMIN DASHBOARD
========================================= */

const $ = id => document.getElementById(id);

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

    container.replaceChildren();

    const element = document.createElement("div");

    element.className = "empty-state";
    element.textContent = message;

    container.appendChild(element);
}


function setLoading(container, message) {
    if (!container) return;

    container.replaceChildren();

    const element = document.createElement("div");

    element.className = "loading";
    element.textContent = message;

    container.appendChild(element);
}


function createElement(tag, className, text) {
    const element = document.createElement(tag);

    if (className) {
        element.className = className;
    }

    if (text !== undefined && text !== null) {
        element.textContent = String(text);
    }

    return element;
}


function normalizeStatus(status) {
    return String(status || "Pending")
        .trim()
        .toLowerCase();
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

        if (!data.session) {
            window.location.replace("index.html");
            return false;
        }

        currentUser = data.session.user;

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

        if (!data) {
            throw new Error("Admin profile not found.");
        }

        currentProfile = data;

        const role = String(data.role || "")
            .trim()
            .toLowerCase();

        if (!["admin", "super_admin"].includes(role)) {
            showMessage(
                "Access denied. Administrator permission required.",
                "error"
            );

            await supabase.auth.signOut();

            window.location.replace("dashboard.html");

            return false;
        }

        if ($("admin-name")) {
            $("admin-name").textContent =
                data.full_name || "Administrator";
        }

        if ($("admin-email")) {
            $("admin-email").textContent =
                data.email || currentUser.email || "";
        }

        return true;

    } catch (error) {
        console.error("Admin verification error:", error);

        showMessage(
            "Admin verification failed. Check your profile and database permissions.",
            "error"
        );

        setTimeout(() => {
            window.location.replace("dashboard.html");
        }, 2500);

        return false;
    }
}


/* =========================================
   LOAD ALL ADMIN DATA
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
        const {
            data,
            error
        } = await supabase
            .from("applications")
            .select("*");

        if (error) throw error;

        applicationsCache = data || [];

        /*
         * Sort locally.
         * This avoids failure if created_at
         * is unavailable in the table.
         */

        applicationsCache.sort((a, b) => {
            return new Date(b.created_at || 0) -
                   new Date(a.created_at || 0);
        });

        await loadApplicationProfiles();

        updateApplicationStats();

        renderApplications();

    } catch (error) {
        console.error("Applications error:", error);

        showEmpty(
            container,
            "Unable to load applications. Check applications table permissions."
        );
    }
}


/* =========================================
   APPLICATION CUSTOMER PROFILES
========================================= */

async function loadApplicationProfiles() {
    const userIds = [
        ...new Set(
            applicationsCache
                .map(app => app.user_id || app.customer_id)
                .filter(Boolean)
        )
    ];

    if (!userIds.length) {
        applicationsCache.forEach(app => {
            app._customerProfile = null;
        });

        return;
    }

    const {
        data,
        error
    } = await supabase
        .from("profiles")
        .select("id,full_name,email")
        .in("id", userIds);

    if (error) {
        console.error("Customer profiles error:", error);

        applicationsCache.forEach(app => {
            app._customerProfile = null;
        });

        return;
    }

    const profileMap = new Map(
        (data || []).map(profile => [
            String(profile.id),
            profile
        ])
    );

    applicationsCache.forEach(app => {
        const userId = app.user_id || app.customer_id;

        app._customerProfile = userId
            ? profileMap.get(String(userId)) || null
            : null;
    });
}


/* =========================================
   APPLICATION STATISTICS
========================================= */

function updateApplicationStats() {
    const apps = applicationsCache;

    const review = apps.filter(app => {
        const status = normalizeStatus(app.status);

        return [
            "pending",
            "in review",
            "in_review"
        ].includes(status);
    }).length;

    const completed = apps.filter(app =>
        normalizeStatus(app.status) === "completed"
    ).length;

    if ($("stat-total")) {
        $("stat-total").textContent = apps.length;
    }

    if ($("stat-review")) {
        $("stat-review").textContent = review;
    }

    if ($("stat-completed")) {
        $("stat-completed").textContent = completed;
    }
}


/* =========================================
   STATUS COLOR
========================================= */

function getStatusColor(status) {
    const value = normalizeStatus(status);

    if (value === "completed") {
        return "var(--good)";
    }

    if (value === "rejected") {
        return "var(--bad)";
    }

    if (
        value === "pending" ||
        value === "in review" ||
        value === "in_review"
    ) {
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

    container.replaceChildren();

    if (!applicationsCache.length) {
        showEmpty(
            container,
            "No applications have been submitted yet."
        );

        return;
    }

    applicationsCache.forEach(app => {
        const profile = app._customerProfile || {};

        const name =
            profile.full_name || "Customer";

        const email =
            profile.email || "Not available";

        const formData =
            app.form_data || {};

        const phone =
            formData.phone || "Not available";

        const service =
            app.service_name || "Service";

        const amount =
            formatCurrency(app.amount);

        const status =
            app.status || "Pending";

        const item = createElement("article", "app-item");

        item.style.borderLeftColor =
            getStatusColor(status);

        const heading = createElement("div", "app-head");

        const title = createElement("div");

        const customerName =
            createElement("h3", "", name);

        const applicationId =
            createElement(
                "p",
                "",
                "Application ID: " + app.id
            );

        title.append(customerName, applicationId);

        const date = createElement(
            "span",
            "app-date",
            formatDate(app.created_at)
        );

        heading.append(title, date);

        const details =
            createElement("div", "app-details");

        const detailItems = [
            ["Email", email],
            ["Phone", phone],
            ["Service", service],
            ["Amount", amount]
        ];

        detailItems.forEach(([label, value]) => {
            const detail =
                createElement("div", "detail-item");

            const labelElement =
                createElement("span", "", label);

            const valueElement =
                createElement("strong", "", value);

            detail.append(labelElement, valueElement);

            details.appendChild(detail);
        });

        const actions =
            createElement("div", "app-actions");

        const currentStatus =
            createElement(
                "span",
                "",
                "Current status: " + status
            );

        const select =
            createElement("select", "status-select");

        select.dataset.id = app.id;

        const statuses = [
            "Pending",
            "In review",
            "In progress",
            "Completed",
            "Rejected"
        ];

        statuses.forEach(statusOption => {
            const option =
                createElement(
                    "option",
                    "",
                    statusOption
                );

            option.value = statusOption;

            if (
                normalizeStatus(status) ===
                normalizeStatus(statusOption)
            ) {
                option.selected = true;
            }

            select.appendChild(option);
        });

        select.addEventListener(
            "change",
            handleStatusChange
        );

        actions.append(currentStatus, select);

        item.append(heading, details, actions);

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

    const oldStatus = oldApp.status || "Pending";

    select.disabled = true;

    try {
        const {
            data,
            error
        } = await supabase
            .from("applications")
            .update({
                status: newStatus
            })
            .eq("id", appId)
            .select("id,status");

        if (error) throw error;

        if (!data || !data.length) {
            throw new Error(
                "Update was not confirmed. Check database permissions."
            );
        }

        showMessage(
            "Application status updated successfully.",
            "success"
        );

        await loadApplications();

    } catch (error) {
        console.error("Status update error:", error);

        select.value = oldStatus;

        showMessage(
            "Unable to update application status. Check your database permissions.",
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
            .select("id,name,price");

        if (error) throw error;

        servicesCache = data || [];

        servicesCache.sort((a, b) =>
            String(a.name || "").localeCompare(
                String(b.name || "")
            )
        );

        if ($("stat-products")) {
            $("stat-products").textContent =
                servicesCache.length;
        }

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

    container.replaceChildren();

    if (!servicesCache.length) {
        showEmpty(
            container,
            "No services are currently registered."
        );

        return;
    }

    servicesCache.forEach(service => {
        const item =
            createElement("div", "admin-service-item");

        const info = createElement("div");

        const name = createElement(
            "strong",
            "",
            service.name || "Unnamed service"
        );

        const id = createElement(
            "small",
            "",
            "Service ID: " + service.id
        );

        info.append(name, id);

        const price = createElement(
            "strong",
            "admin-price",
            formatCurrency(service.price)
        );

        item.append(info, price);

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
            .select("*");

        if (error) throw error;

        paymentsCache = data || [];

        /*
         * Sort only when date information exists.
         */

        paymentsCache.sort((a, b) => {
            return new Date(b.created_at || b.created || 0) -
                   new Date(a.created_at || a.created || 0);
        });

        renderPayments();

    } catch (error) {
        console.error("Payments error:", error);

        showEmpty(
            container,
            "Unable to load payment records. Check payments table permissions."
        );
    }
}


function renderPayments() {
    const container = $("admin-payments-list");

    if (!container) return;

    container.replaceChildren();

    if (!paymentsCache.length) {
        showEmpty(
            container,
            "No payment records are currently available."
        );

        return;
    }

    paymentsCache.forEach(payment => {
        const item =
            createElement("div", "admin-payment-item");

        const info = createElement("div");

        const service = createElement(
            "strong",
            "",
            payment.service_name ||
            payment.service ||
            "Payment"
        );

        const reference = createElement(
            "small",
            "",
            "Reference: " +
            (
                payment.reference ||
                payment.ref ||
                "N/A"
            )
        );

        const date = createElement(
            "small",
            "",
            "Date: " +
            formatDate(
                payment.created_at ||
                payment.created
            )
        );

        const status = createElement(
            "small",
            "",
            "Status: " + (payment.status || "Not specified")
        );

        info.append(service, reference, date, status);

        const amount = createElement(
            "strong",
            "admin-price",
            formatCurrency(payment.amount)
        );

        item.append(info, amount);

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
        realtimeChannel = null;
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
            () => {
                loadApplications();
            }
        )

        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "services"
            },
            () => {
                loadServices();
            }
        )

        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "payments"
            },
            () => {
                loadPayments();
            }
        )

        .subscribe(status => {
            if (status === "SUBSCRIBED") {
                console.log(
                    "EIS Admin Realtime connected."
                );
            }

            if (
                status === "CHANNEL_ERROR" ||
                status === "TIMED_OUT"
            ) {
                console.error(
                    "Admin Realtime connection error:",
                    status
                );
            }
        });
}


/* =========================================
   AUTH STATE LISTENER
========================================= */

function initializeAuthListener() {
    supabase.auth.onAuthStateChange(
        (event, session) => {
            if (event === "SIGNED_OUT" || !session) {
                window.location.replace("index.html");
            }
        }
    );
}


/* =========================================
   INITIALIZATION
========================================= */

async function initializeAdminDashboard() {
    console.log(
        "EIS Admin Dashboard initializing..."
    );

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

    console.log(
        "EIS Admin Dashboard ready."
    );
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
