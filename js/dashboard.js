/* =====================================================
   EIS DIGITAL SERVICES
   FILE: js/dashboard.js
   CUSTOMER DASHBOARD VERSION 17
===================================================== */

import { supabase } from "./supabase.js";

/* =====================================================
   GLOBAL VARIABLES
===================================================== */

let currentUser = null;
let currentProfile = null;
let selectedService = null;
let servicesCache = [];
let applicationsCache = [];
let notificationsCache = [];
let demoPaymentCompleted = false;

const $ = (id) => document.getElementById(id);


/* =====================================================
   MESSAGE SYSTEM
===================================================== */

function showMessage(message, type = "info", targetId = "pay-msg") {

    const box = $(targetId);

    if (!box) {
        console.log(message);
        return;
    }

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

    if (Number.isNaN(value.getTime())) {
        return "N/A";
    }

    return value.toLocaleDateString("en-NG", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });

}


function formatDateTime(date) {

    if (!date) return "";

    const value = new Date(date);

    if (Number.isNaN(value.getTime())) {
        return "";
    }

    return value.toLocaleString("en-NG", {
        dateStyle: "medium",
        timeStyle: "short"
    });

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
   LOAD USER PROFILE
===================================================== */

async function loadUserProfile() {

    if (!currentUser) return;

    const welcome = $("welcome");
    const adminButton = $("nav-admin");

    if (adminButton) {
        adminButton.style.display = "none";
    }

    if (welcome) {
        welcome.textContent = `Welcome, ${currentUser.email}`;
    }

    try {

        const { data, error } = await supabase
            .from("profiles")
            .select("id,full_name,email,phone,role")
            .eq("id", currentUser.id)
            .maybeSingle();

        if (error) throw error;

        if (!data) {
            console.error("Profile not found.");
            return;
        }

        currentProfile = data;

        if (welcome) {
            welcome.textContent =
                `Welcome, ${data.full_name || currentUser.email}`;
        }

        const role = String(data.role || "")
            .trim()
            .toLowerCase();

        if (
            ["admin", "super_admin"].includes(role) &&
            adminButton
        ) {
            adminButton.style.display = "inline-flex";
        }

    } catch (error) {

        console.error("Profile loading error:", error);

        showMessage(
            error.message || "Unable to load profile.",
            "err"
        );
    }

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
            .order("created_at", {
                ascending: false
            });

        if (error) throw error;

        servicesCache = data || [];

        container.replaceChildren();

        if (servicesCache.length === 0) {

            container.textContent =
                "No services are available at the moment.";

            return;
        }

        servicesCache.forEach(service => {

            const card = document.createElement("div");
            card.className = "service-card";

            const title = document.createElement("h3");
            title.textContent = service.name || "Service";

            const price = document.createElement("p");
            price.textContent = formatCurrency(service.price);

            const button = document.createElement("button");
            button.type = "button";
            button.className = "btn btn-primary";
            button.textContent = "Select Service";

            button.addEventListener("click", () => {
                selectService(service);
            });

            card.append(title, price, button);

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

    selectedService = service;
    demoPaymentCompleted = false;

    const paySection = $("pay-section");
    const form = $("app-form");

    if (paySection) {
        paySection.style.display = "block";
    }

    if (form) {
        form.style.display = "none";
    }

    const payButton = $("btn-pay");

    if (payButton) {

        payButton.disabled = false;
        payButton.textContent = "Pay Now";

    }

    showMessage(
        `Selected: ${service.name}. Amount: ${formatCurrency(service.price)}`,
        "info"
    );

    if (paySection) {

        paySection.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });

    }

}


/* =====================================================
   DEMO PAYMENT
===================================================== */

async function handleDemoPayment() {

    if (!selectedService) {

        showMessage(
            "Please select a service first.",
            "err"
        );

        return;
    }

    const button = $("btn-pay");
    const form = $("app-form");

    if (button) {

        button.disabled = true;
        button.textContent = "Processing...";

    }

    try {

        /*
          DEMO PAYMENT ONLY.

          This does not charge money.
          It is not a verified payment.
        */

        demoPaymentCompleted = true;

        showMessage(
            "Demo payment completed. You can now complete the application form.",
            "info"
        );

        if (form) {

            form.style.display = "block";

            form.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });

        }

        if (button) {
            button.textContent = "Demo Payment Completed";
        }

    } catch (error) {

        console.error("Demo payment error:", error);

        demoPaymentCompleted = false;

        showMessage(
            "Payment process failed.",
            "err"
        );

        if (button) {

            button.disabled = false;
            button.textContent = "Pay Now";

        }

    }

}


/* =====================================================
   APPLICATION FORM PREPARATION
===================================================== */

function prepareApplicationForm() {

    const form = $("app-form");

    if (!form) return;

    /*
       These fields remain hidden during testing.
       Do not collect sensitive bank or BVN information.
    */

    const sensitiveFields = [
        "f-kegow",
        "f-bvn",
        "f-bankName",
        "f-accountNo",
        "f-accountName",
        "f-address",
        "f-dob"
    ];

    sensitiveFields.forEach(id => {

        const field = $(id);

        if (!field) return;

        field.required = false;

        const wrapper = field.closest(".form-grid > div");

        if (wrapper) {
            wrapper.style.display = "none";
        }

    });


    const states = [
        "Abia",
        "Adamawa",
        "Akwa Ibom",
        "Anambra",
        "Bauchi",
        "Bayelsa",
        "Benue",
        "Borno",
        "Cross River",
        "Delta",
        "Ebonyi",
        "Edo",
        "Ekiti",
        "Enugu",
        "FCT",
        "Gombe",
        "Imo",
        "Jigawa",
        "Kaduna",
        "Kano",
        "Katsina",
        "Kebbi",
        "Kogi",
        "Kwara",
        "Lagos",
        "Nasarawa",
        "Niger",
        "Ogun",
        "Ondo",
        "Osun",
        "Oyo",
        "Plateau",
        "Rivers",
        "Sokoto",
        "Taraba",
        "Yobe",
        "Zamfara"
    ];

    [
        "f-agentState",
        "f-stateRes"

    ].forEach(id => {

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
   APPLICATION STATUS BADGE
===================================================== */

function createStatusBadge(status) {

    const badge = document.createElement("span");

    const normalized = String(status || "pending")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "_");

    badge.className = `status-badge ${normalized}`;

    badge.textContent = String(status || "Pending")
        .replace(/_/g, " ")
        .replace(/\b\w/g, letter => letter.toUpperCase());

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
            .select(
                "id,user_id,service_name,amount,status,created_at"
            )
            .eq("user_id", currentUser.id)
            .order("created_at", {
                ascending: false
            });

        if (error) throw error;

        applicationsCache = data || [];

        if (applicationsCache.length === 0) {

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

        container.replaceChildren();

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

    if (list) {
        list.textContent = "Loading notifications...";
    }

    try {

        const { data, error } = await supabase
            .from("notifications")
            .select("id,user_id,title,message,is_read,created_at")
            .eq("user_id", currentUser.id)
            .order("created_at", {
                ascending: false
            })
            .limit(20);

        if (error) throw error;

        notificationsCache = data || [];

        const unread = notificationsCache.filter(
            notification => !notification.is_read
        ).length;

        if (count) {

            count.textContent = unread > 99 ? "99+" : String(unread);

            count.style.display =
                unread > 0 ? "flex" : "none";

        }

        renderNotifications();

    } catch (error) {

        console.error("Notifications loading error:", error);

        if (list) {
            list.textContent =
                "Unable to load notifications.";
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

    if (notificationsCache.length === 0) {

        const empty = document.createElement("p");

        empty.textContent = "You have no notifications.";
        empty.style.color = "#7b8495";
        empty.style.fontSize = "13px";

        list.appendChild(empty);

        return;
    }

    notificationsCache.forEach(notification => {

        const item = document.createElement("div");

        item.className = "notification-item";

        if (!notification.is_read) {
            item.style.background = "#f5f8ff";
        }

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


/* =====================================================
   MARK NOTIFICATIONS AS READ
===================================================== */

async function markNotificationsAsRead() {

    if (!currentUser) return;

    const unreadIds = notificationsCache
        .filter(notification => !notification.is_read)
        .map(notification => notification.id);

    if (!unreadIds.length) return;

    try {

        const { error } = await supabase
            .from("notifications")
            .update({ is_read: true })
            .eq("user_id", currentUser.id)
            .in("id", unreadIds)
            .eq("is_read", false);

        if (error) throw error;

        notificationsCache = notificationsCache.map(notification => ({
            ...notification,
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

    button.addEventListener("click", async () => {

        const isOpen =
            dropdown.classList.toggle("open");

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


/* =====================================================
   SUBMIT APPLICATION
===================================================== */

async function submitApplication(event) {

    event.preventDefault();

    const form = $("app-form");

    if (!currentUser) {

        showMessage(
            "Please log in first.",
            "err",
            "form-msg"
        );

        return;
    }

    if (!selectedService) {

        showMessage(
            "Please select a service first.",
            "err",
            "form-msg"
        );

        return;
    }

    if (!demoPaymentCompleted) {

        showMessage(
            "Please complete the payment step first.",
            "err",
            "form-msg"
        );

        return;
    }

    const firstName = $("f-firstName")?.value.trim();
    const lastName = $("f-lastName")?.value.trim();
    const email = $("f-email")?.value.trim();
    const phone = $("f-phone")?.value.trim();

    const agentState = $("f-agentState")?.value;
    const stateResidence = $("f-stateRes")?.value;

    if (
        !firstName ||
        !lastName ||
        !email ||
        !phone ||
        !agentState ||
        !stateResidence
    ) {

        showMessage(
            "Please complete all required fields.",
            "err",
            "form-msg"
        );

        return;
    }

    const button = form.querySelector(
        'button[type="submit"]'
    );

    if (button) {

        button.disabled = true;
        button.textContent = "Submitting...";

    }

    try {

        const safeFormData = {

            first_name: firstName,
            last_name: lastName,
            email: email,
            phone: phone,
            agent_state: agentState,
            state_of_residence: stateResidence

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

        showMessage(
            "Application submitted successfully!",
            "ok",
            "form-msg"
        );

        form.reset();

        selectedService = null;
        demoPaymentCompleted = false;

        form.style.display = "none";

        const paySection = $("pay-section");

        if (paySection) {
            paySection.style.display = "none";
        }

        await loadApplications();

    } catch (error) {

        console.error(
            "Application submission error:",
            error
        );

        showMessage(
            error.message || "Application submission failed.",
            "err",
            "form-msg"
        );

    } finally {

        if (button) {

            button.disabled = false;
            button.textContent = "Submit application";

        }

    }

}


/* =====================================================
   LOGOUT
===================================================== */

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


/* =====================================================
   INITIALIZE DASHBOARD
===================================================== */

async function initializeDashboard() {

    const authenticated = await checkUserSession();

    if (!authenticated) return;

    prepareApplicationForm();

    setupNotificationDropdown();


    const form = $("app-form");

    if (form) {

        form.addEventListener(
            "submit",
            submitApplication
        );

    }


    const logout = $("nav-logout");

    if (logout) {

        logout.addEventListener(
            "click",
            logoutUser
        );

    }


    const payButton = $("btn-pay");

    if (payButton) {

        payButton.addEventListener(
            "click",
            handleDemoPayment
        );

    }


    const paySection = $("pay-section");

    if (paySection) {
        paySection.style.display = "none";
    }

    if (form) {
        form.style.display = "none";
    }


    await loadUserProfile();

    await Promise.all([

        loadServices(),

        loadApplications(),

        loadNotifications()

    ]);

}


/* =====================================================
   AUTH STATE LISTENER
===================================================== */

supabase.auth.onAuthStateChange((event) => {

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

    handleDemoPayment,

    formatCurrency,

    formatDate

};
