/* =========================================================
   EIS DIGITAL SERVICES
   FILE 5: js/dashboard.js
   Dashboard Management
   ========================================================= */

import { supabase } from "./supabase.js";

/* ===============================
   GLOBAL SETTINGS
================================ */

const TABLES = {
    profiles: "profiles",
    services: "services",
    applications: "applications",
    payments: "payments"
};

let currentUser = null;
let currentProfile = null;
let servicesCache = [];
let applicationsCache = [];

/* ===============================
   SAFE DOM HELPERS
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
        getElement("dashboard-message") ||
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

function formatCurrency(amount) {
    return new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: "NGN",
        maximumFractionDigits: 2
    }).format(Number(amount) || 0);
}

function formatDate(date) {
    if (!date) return "N/A";

    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) {
        return "N/A";
    }

    return parsed.toLocaleDateString("en-NG", {
        year: "numeric",
        month: "short",
        day: "numeric"
    });
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        };

        return entities[character];
    });
}

/* ===============================
   AUTHENTICATION
================================ */

async function checkUserSession() {
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
        console.error("Session error:", error);

        window.location.href = "index.html";

        return false;
    }
}

/* ===============================
   LOAD USER PROFILE
================================ */

async function loadUserProfile() {
    if (!currentUser) return null;

    try {
        const { data, error } = await supabase
            .from(TABLES.profiles)
            .select("*")
            .eq("id", currentUser.id)
            .maybeSingle();

        if (error) throw error;

        currentProfile = data;

        if (data) {
            setText("user-name", data.full_name || data.name || "Customer");
            setText("profile-name", data.full_name || data.name || "Customer");
            setText("user-email", currentUser.email);
            setText("profile-email", currentUser.email);
        } else {
            setText("user-name", currentUser.email);
            setText("user-email", currentUser.email);
        }

        return data;

    } catch (error) {
        console.error("Profile loading error:", error);

        showMessage(
            "An kasa ɗauko bayanan profile ɗinka.",
            "error"
        );

        return null;
    }
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
            .from(TABLES.services)
            .select("*")
            .eq("active", true)
            .order("created_at", { ascending: false });

        if (error) throw error;

        servicesCache = data || [];

        if (!container) return servicesCache;

        container.replaceChildren();

        if (servicesCache.length === 0) {
            const message = document.createElement("p");
            message.textContent = "No services are currently available.";
            container.appendChild(message);

            return servicesCache;
        }

        servicesCache.forEach(service => {
            const card = document.createElement("div");

            card.className = "service-card";

            const title = document.createElement("h3");
            title.textContent = service.name || service.title || "Service";

            const description = document.createElement("p");
            description.textContent =
                service.description || "No description available.";

            const price = document.createElement("p");
            price.textContent = formatCurrency(service.price);

            const button = document.createElement("button");
            button.type = "button";
            button.textContent = "Apply Now";

            button.addEventListener("click", () => {
                selectService(service.id);
            });

            card.append(title, description, price, button);

            container.appendChild(card);
        });

        return servicesCache;

    } catch (error) {
        console.error("Services error:", error);

        if (container) {
            container.textContent = "Unable to load services.";
        }

        showMessage(
            "An samu matsala wajen ɗauko services.",
            "error"
        );

        return [];
    }
}

/* ===============================
   SELECT SERVICE
================================ */

function selectService(serviceId) {
    const service = servicesCache.find(
        item => String(item.id) === String(serviceId)
    );

    if (!service) {
        showMessage("Ba a sami wannan service ba.", "error");
        return;
    }

    const serviceInput =
        getElement("service-id") ||
        getElement("selected-service");

    if (serviceInput) {
        serviceInput.value = service.id;
    }

    setText("selected-service-name", service.name || service.title);
    setText("selected-service-price", formatCurrency(service.price));

    const applicationSection =
        getElement("application-section");

    if (applicationSection) {
        applicationSection.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }
}

/* ===============================
   LOAD APPLICATIONS
================================ */

async function loadApplications() {
    if (!currentUser) return [];

    const container =
        getElement("applications-container") ||
        getElement("applications-list");

    try {
        const { data, error } = await supabase
            .from(TABLES.applications)
            .select("*")
            .eq("user_id", currentUser.id)
            .order("created_at", { ascending: false });

        if (error) throw error;

        applicationsCache = data || [];

        if (!container) {
            updateDashboardStatistics();
            return applicationsCache;
        }

        container.replaceChildren();

        if (applicationsCache.length === 0) {
            const message = document.createElement("p");
            message.textContent = "You have not submitted any application yet.";

            container.appendChild(message);

            updateDashboardStatistics();

            return applicationsCache;
        }

        applicationsCache.forEach(application => {
            const card = document.createElement("div");

            card.className = "application-card";

            const title = document.createElement("h3");
            title.textContent =
                application.service_name ||
                application.service ||
                "Application";

            const status = document.createElement("p");
            status.textContent =
                `Status: ${application.status || "Pending"}`;

            const reference = document.createElement("p");
            reference.textContent =
                `Reference: ${application.id}`;

            const date = document.createElement("p");
            date.textContent =
                `Date: ${formatDate(application.created_at)}`;

            card.append(title, status, reference, date);

            container.appendChild(card);
        });

        updateDashboardStatistics();

        return applicationsCache;

    } catch (error) {
        console.error("Applications error:", error);

        if (container) {
            container.textContent =
                "Unable to load your applications.";
        }

        showMessage(
            "An samu matsala wajen ɗauko applications.",
            "error"
        );

        return [];
    }
}

/* ===============================
   DASHBOARD STATISTICS
================================ */

function updateDashboardStatistics() {
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
   SUBMIT APPLICATION
================================ */

async function submitApplication(event) {
    if (event) {
        event.preventDefault();
    }

    if (!currentUser) {
        showMessage("Please login first.", "error");
        return;
    }

    const form =
        getElement("application-form") ||
        getElement("service-form");

    if (!form) {
        showMessage("Application form was not found.", "error");
        return;
    }

    const submitButton =
        form.querySelector('[type="submit"]');

    const serviceInput =
        getElement("service-id") ||
        getElement("selected-service");

    const serviceId = serviceInput?.value;

    if (!serviceId) {
        showMessage("Please select a service first.", "error");
        return;
    }

    const service = servicesCache.find(
        item => String(item.id) === String(serviceId)
    );

    if (!service) {
        showMessage("Selected service is unavailable.", "error");
        return;
    }

    const formData = new FormData(form);
    const safeFormData = {};

    for (const [key, value] of formData.entries()) {
        if (typeof value === "string") {
            safeFormData[key] = value.trim();
        }
    }

    /*
      IMPORTANT:
      Do not collect or store real BVN, passwords,
      bank PINs, card details or other highly sensitive
      identity information in this browser-based form.
      Use dummy data while testing.
    */

    const applicationData = {
        user_id: currentUser.id,
        service_id: service.id,
        service_name: service.name || service.title || "Service",
        status: "pending",
        form_data: safeFormData
    };

    try {
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = "Submitting...";
        }

        const { data, error } = await supabase
            .from(TABLES.applications)
            .insert([applicationData])
            .select()
            .single();

        if (error) throw error;

        showMessage(
            "Application submitted successfully!",
            "success"
        );

        form.reset();

        if (serviceInput) {
            serviceInput.value = "";
        }

        await loadApplications();

        return data;

    } catch (error) {
        console.error("Application submission error:", error);

        showMessage(
            error.message || "Application submission failed.",
            "error"
        );

        return null;

    } finally {
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = "Submit Application";
        }
    }
}

/* ===============================
   DEMO PAYMENT
================================ */

async function createDemoPayment(serviceId) {
    if (!currentUser) {
        showMessage("Please login first.", "error");
        return null;
    }

    const service = servicesCache.find(
        item => String(item.id) === String(serviceId)
    );

    if (!service) {
        showMessage("Service not found.", "error");
        return null;
    }

    /*
      THIS IS ONLY A TEST RECORD.
      It does not process real money.
      Never mark a real payment as successful
      without verification from a payment provider
      through a secure backend.
    */

    const reference =
        "EIS-DEMO-" +
        Date.now() +
        "-" +
        Math.random().toString(36).slice(2, 8).toUpperCase();

    try {
        const { data, error } = await supabase
            .from(TABLES.payments)
            .insert([{
                ref: reference,
                user_id: currentUser.id,
                service_id: service.id,
                amount: Number(service.price) || 0,
                status: "pending"
            }])
            .select()
            .single();

        if (error) throw error;

        showMessage(
            "Demo payment record created. No real payment was made.",
            "info"
        );

        return data;

    } catch (error) {
        console.error("Demo payment error:", error);

        showMessage(
            "An kasa ƙirƙirar demo payment.",
            "error"
        );

        return null;
    }
}

/* ===============================
   LOGOUT
================================ */

async function logoutUser() {
    try {
        const { error } = await supabase.auth.signOut();

        if (error) throw error;

        window.location.href = "index.html";

    } catch (error) {
        console.error("Logout error:", error);

        showMessage(
            "Logout failed. Please try again.",
            "error"
        );
    }
}

/* ===============================
   EVENT LISTENERS
================================ */

function initializeDashboardEvents() {
    const applicationForm =
        getElement("application-form") ||
        getElement("service-form");

    if (applicationForm) {
        applicationForm.addEventListener(
            "submit",
            submitApplication
        );
    }

    const logoutButton =
        getElement("logout-btn") ||
        getElement("logout-button");

    if (logoutButton) {
        logoutButton.addEventListener("click", logoutUser);
    }

    document.querySelectorAll("[data-service-id]").forEach(button => {
        button.addEventListener("click", () => {
            selectService(button.dataset.serviceId);
        });
    });
}

/* ===============================
   INITIALIZE DASHBOARD
================================ */

async function initializeDashboard() {
    const authenticated = await checkUserSession();

    if (!authenticated) return;

    initializeDashboardEvents();

    await loadUserProfile();

    await Promise.all([
        loadServices(),
        loadApplications()
    ]);
}

/* ===============================
   AUTH STATE LISTENER
================================ */

supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") {
        window.location.href = "index.html";
    }
});

/* ===============================
   START
================================ */

document.addEventListener("DOMContentLoaded", () => {
    initializeDashboard();
});

/* ===============================
   GLOBAL FUNCTIONS
================================ */

window.EISDashboard = {
    loadServices,
    loadApplications,
    loadUserProfile,
    submitApplication,
    selectService,
    createDemoPayment,
    logoutUser,
    formatCurrency,
    formatDate
};
