/* =====================================================
   EIS DIGITAL SERVICES
   FILE 6: js/admin.js
   Admin Dashboard Management
===================================================== */

import { supabase } from "./supabase.js";

/* ===============================
   GLOBAL VARIABLES
================================ */

let currentUser = null;
let currentProfile = null;
let applicationsCache = [];

/* ===============================
   DOM HELPERS
================================ */

function getElement(id) {
    return document.getElementById(id);
}

function setText(id, value) {
    const element = getElement(id);

    if (element) {
        element.textContent = value ?? "";
    }
}

function showMessage(message, type = "info") {
    const container =
        getElement("admin-message") ||
        getElement("message-box") ||
        getElement("notification");

    if (!container) {
        alert(message);
        return;
    }

    container.textContent = message;
    container.className = `notification ${type}`;
    container.hidden = false;

    clearTimeout(showMessage.timer);

    showMessage.timer = setTimeout(() => {
        container.hidden = true;
    }, 5000);
}

function formatDate(date) {
    if (!date) return "N/A";

    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) {
        return "N/A";
    }

    return parsed.toLocaleString("en-NG");
}

function formatCurrency(amount) {
    return new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: "NGN",
        maximumFractionDigits: 2
    }).format(Number(amount) || 0);
}

/* ===============================
   AUTHENTICATION
================================ */

async function checkAdminSession() {
    try {
        const {
            data: { user },
            error
        } = await supabase.auth.getUser();

        if (error) throw error;

        if (!user) {
            window.location.href = "index.html";
            return false;
        }

        currentUser = user;

        return true;

    } catch (error) {
        console.error("Admin authentication error:", error);

        window.location.href = "index.html";

        return false;
    }
}

/* ===============================
   ADMIN PROFILE
================================ */

async function loadAdminProfile() {
    try {
        const { data, error } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", currentUser.id)
            .maybeSingle();

        if (error) throw error;

        if (!data) {
            showMessage("Admin profile was not found.", "error");
            return false;
        }

        currentProfile = data;

        const role = String(data.role || "").toLowerCase();

        if (!["admin", "super_admin"].includes(role)) {
            showMessage(
                "Access denied. Admin permission required.",
                "error"
            );

            setTimeout(() => {
                window.location.href = "dashboard.html";
            }, 1500);

            return false;
        }

        setText(
            "admin-name",
            data.full_name || data.name || "Administrator"
        );

        setText("admin-email", currentUser.email);

        return true;

    } catch (error) {
        console.error("Admin profile error:", error);

        showMessage(
            "Unable to verify admin profile.",
            "error"
        );

        return false;
    }
}

/* ===============================
   LOAD APPLICATIONS
================================ */

async function loadApplications() {
    const container =
        getElement("applications-container") ||
        getElement("applications-list") ||
        getElement("admin-applications");

    try {
        const { data, error } = await supabase
            .from("applications")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) throw error;

        applicationsCache = data || [];

        if (!container) {
            updateStatistics();
            return applicationsCache;
        }

        container.replaceChildren();

        if (applicationsCache.length === 0) {
            const empty = document.createElement("p");

            empty.textContent = "No applications found.";

            container.appendChild(empty);

            updateStatistics();

            return applicationsCache;
        }

        applicationsCache.forEach(application => {
            const card = document.createElement("div");

            card.className = "application-card";

            const heading = document.createElement("h3");

            heading.textContent =
                application.service_name ||
                application.service ||
                "Application";

            const user = document.createElement("p");

            user.textContent =
                `Customer ID: ${application.user_id || "N/A"}`;

            const status = document.createElement("p");

            status.textContent =
                `Status: ${application.status || "Pending"}`;

            const date = document.createElement("p");

            date.textContent =
                `Date: ${formatDate(application.created_at)}`;

            const actions = document.createElement("div");

            actions.className = "application-actions";

            const approveButton = document.createElement("button");

            approveButton.type = "button";
            approveButton.textContent = "Approve";

            approveButton.addEventListener("click", () => {
                updateApplicationStatus(
                    application.id,
                    "approved"
                );
            });

            const rejectButton = document.createElement("button");

            rejectButton.type = "button";
            rejectButton.textContent = "Reject";

            rejectButton.addEventListener("click", () => {
                updateApplicationStatus(
                    application.id,
                    "rejected"
                );
            });

            const pendingButton = document.createElement("button");

            pendingButton.type = "button";
            pendingButton.textContent = "Pending";

            pendingButton.addEventListener("click", () => {
                updateApplicationStatus(
                    application.id,
                    "pending"
                );
            });

            actions.append(
                approveButton,
                rejectButton,
                pendingButton
            );

            card.append(
                heading,
                user,
                status,
                date,
                actions
            );

            container.appendChild(card);
        });

        updateStatistics();

        return applicationsCache;

    } catch (error) {
        console.error("Load applications error:", error);

        if (container) {
            container.textContent =
                "Unable to load applications.";
        }

        showMessage(
            "An samu matsala wajen ɗauko applications.",
            "error"
        );

        return [];
    }
}

/* ===============================
   UPDATE APPLICATION STATUS
================================ */

async function updateApplicationStatus(applicationId, newStatus) {
    const allowedStatuses = [
        "pending",
        "approved",
        "rejected"
    ];

    if (!allowedStatuses.includes(newStatus)) {
        showMessage("Invalid application status.", "error");
        return;
    }

    if (!applicationId) {
        showMessage("Application ID is missing.", "error");
        return;
    }

    const confirmed = confirm(
        `Are you sure you want to change this application to ${newStatus}?`
    );

    if (!confirmed) return;

    try {
        const { error } = await supabase
            .from("applications")
            .update({
                status: newStatus
            })
            .eq("id", applicationId);

        if (error) throw error;

        showMessage(
            `Application status changed to ${newStatus}.`,
            "success"
        );

        await loadApplications();

    } catch (error) {
        console.error("Status update error:", error);

        showMessage(
            error.message || "Unable to update application.",
            "error"
        );
    }
}

/* ===============================
   STATISTICS
================================ */

function updateStatistics() {
    const total = applicationsCache.length;

    const pending = applicationsCache.filter(
        item => String(item.status).toLowerCase() === "pending"
    ).length;

    const approved = applicationsCache.filter(
        item => String(item.status).toLowerCase() === "approved"
    ).length;

    const rejected = applicationsCache.filter(
        item => String(item.status).toLowerCase() === "rejected"
    ).length;

    setText("total-applications", total);
    setText("pending-applications", pending);
    setText("approved-applications", approved);
    setText("rejected-applications", rejected);

    setText("stat-total", total);
    setText("stat-pending", pending);
    setText("stat-approved", approved);
    setText("stat-rejected", rejected);
}

/* ===============================
   LOAD SERVICES
================================ */

async function loadServices() {
    const container =
        getElement("services-container") ||
        getElement("services-list");

    try {
        const { data, error } = await supabase
            .from("services")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) throw error;

        if (!container) return data || [];

        container.replaceChildren();

        (data || []).forEach(service => {
            const card = document.createElement("div");

            card.className = "service-card";

            const title = document.createElement("h3");

            title.textContent =
                service.name || service.title || "Service";

            const price = document.createElement("p");

            price.textContent = formatCurrency(service.price);

            const description = document.createElement("p");

            description.textContent =
                service.description || "";

            card.append(title, description, price);

            container.appendChild(card);
        });

        setText("stat-products", (data || []).length);

        return data || [];

    } catch (error) {
        console.error("Services loading error:", error);

        showMessage(
            "Unable to load services.",
            "error"
        );

        return [];
    }
}

/* ===============================
   LOAD PAYMENTS
================================ */

async function loadPayments() {
    const container =
        getElement("payments-container") ||
        getElement("payments-list");

    try {
        const { data, error } = await supabase
            .from("payments")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) throw error;

        if (!container) return data || [];

        container.replaceChildren();

        if (!data || data.length === 0) {
            const empty = document.createElement("p");

            empty.textContent = "No payment records found.";

            container.appendChild(empty);

            return [];
        }

        data.forEach(payment => {
            const row = document.createElement("div");

            row.className = "payment-card";

            const reference = document.createElement("p");

            reference.textContent =
                `Reference: ${payment.ref || "N/A"}`;

            const amount = document.createElement("p");

            amount.textContent =
                `Amount: ${formatCurrency(payment.amount)}`;

            const status = document.createElement("p");

            status.textContent =
                `Status: ${payment.status || "Pending"}`;

            row.append(reference, amount, status);

            container.appendChild(row);
        });

        return data;

    } catch (error) {
        console.error("Payments loading error:", error);

        showMessage(
            "Unable to load payment records.",
            "error"
        );

        return [];
    }
}

/* ===============================
   LOGOUT
================================ */

async function logoutAdmin() {
    try {
        const { error } = await supabase.auth.signOut();

        if (error) throw error;

        window.location.href = "index.html";

    } catch (error) {
        console.error("Admin logout error:", error);

        showMessage(
            "Logout failed. Please try again.",
            "error"
        );
    }
}

/* ===============================
   EVENT LISTENERS
================================ */

function initializeAdminEvents() {
    const logoutButton =
        getElement("logout-btn") ||
        getElement("logout-button");

    if (logoutButton) {
        logoutButton.addEventListener("click", logoutAdmin);
    }

    const refreshButton =
        getElement("refresh-applications");

    if (refreshButton) {
        refreshButton.addEventListener(
            "click",
            loadApplications
        );
    }

    const refreshPayments =
        getElement("refresh-payments");

    if (refreshPayments) {
        refreshPayments.addEventListener(
            "click",
            loadPayments
        );
    }
}

/* ===============================
   INITIALIZE ADMIN DASHBOARD
================================ */

async function initializeAdminDashboard() {
    const authenticated = await checkAdminSession();

    if (!authenticated) return;

    const authorized = await loadAdminProfile();

    if (!authorized) return;

    initializeAdminEvents();

    await Promise.all([
        loadApplications(),
        loadServices(),
        loadPayments()
    ]);
}

/* ===============================
   AUTH STATE LISTENER
================================ */

supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") {
        window.location.href = "index.html";
    }
});

/* ===============================
   START ADMIN DASHBOARD
================================ */

document.addEventListener("DOMContentLoaded", () => {
    initializeAdminDashboard();
});

/* ===============================
   GLOBAL FUNCTIONS
================================ */

window.EISAdmin = {
    loadApplications,
    loadServices,
    loadPayments,
    updateApplicationStatus,
    updateStatistics,
    logoutAdmin,
    formatCurrency,
    formatDate
};
