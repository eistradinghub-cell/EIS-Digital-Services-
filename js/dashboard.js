/* =====================================================
   EIS DIGITAL SERVICES
   FILE: js/dashboard.js
   CUSTOMER DASHBOARD VERSION 18
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

let draftSaveTimer = null;

const $ = (id) => document.getElementById(id);

const DRAFT_PREFIX = "eis_application_draft_";


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
   APPLICATION DRAFT STORAGE
   All non-file form fields are saved as a draft.
===================================================== */

function getDraftKey() {

    if (!currentUser) return null;

    return `${DRAFT_PREFIX}${currentUser.id}`;

}


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


function saveApplicationDraft() {

    const key = getDraftKey();

    if (!key) return;

    if (!selectedService) return;

    try {

        const draft = {
            version: 1,
            service_id: selectedService.id,
            form_data: getApplicationFormData(),
            form_open: Boolean(demoPaymentCompleted),
            saved_at: new Date().toISOString()
        };

        localStorage.setItem(
            key,
            JSON.stringify(draft)
        );

    } catch (error) {

        console.error("Draft saving error:", error);

    }

}


function scheduleDraftSave() {

    clearTimeout(draftSaveTimer);

    draftSaveTimer = setTimeout(() => {
        saveApplicationDraft();
    }, 300);

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

    let draft;

    try {

        const stored = localStorage.getItem(key);

        if (!stored) return;

        draft = JSON.parse(stored);

    } catch (error) {

        console.error("Draft reading error:", error);

        return;
    }

    if (!draft || draft.version !== 1) return;

    const service = servicesCache.find(item =>
        String(item.id) === String(draft.service_id)
    );

    if (!service) {

        showMessage(
            "Your saved application was found, but its service is no longer available. Please select the service again.",
            "info"
        );

        return;
    }

    selectedService = service;

    const data = draft.form_data || {};

    const fields = {
        "f-kegow": data.kegow_account,
        "f-agentState": data.agent_location_state,
        "f-bvn": data.bvn,
        "f-bankName": data.bank_name,
        "f-accountNo": data.account_number,
        "f-accountName": data.account_name,
        "f-firstName": data.first_name,
        "f-middleName": data.middle_name,
        "f-lastName": data.last_name,
        "f-email": data.email,
        "f-phone": data.phone,
        "f-altPhone": data.alternative_phone,
        "f-homeAddress": data.home_address,
        "f-stateRes": data.state_of_residence,
        "f-dob": data.date_of_birth,
        "f-lga": data.local_government,
        "f-zone": data.geopolitical_zone
    };

    Object.entries(fields).forEach(([id, value]) => {

        const field = $(id);

        if (field && value !== undefined && value !== null) {
            field.value = value;
        }

    });

    if (draft.form_open === true) {

        demoPaymentCompleted = true;

        const paySection = $("pay-section");
        const form = $("app-form");
        const button = $("btn-pay");

        if (paySection) {
            paySection.style.display = "block";
        }

        if (form) {
            form.style.display = "block";
        }

        if (button) {
            button.disabled = false;
            button.textContent = "Demo Payment Completed";
        }

        showMessage(
            "Your saved application has been restored. Continue where you stopped.",
            "info",
            "form-msg"
        );

    } else {

        showMessage(
            `Your saved application for ${service.name} has been restored. Continue with the payment demonstration.`,
            "info"
        );

        const paySection = $("pay-section");

        if (paySection) {
            paySection.style.display = "block";
        }

    }

}


function setupDraftAutoSave() {

    const form = $("app-form");

    if (!form) return;

    form.addEventListener("input", scheduleDraftSave);

    form.addEventListener("change", scheduleDraftSave);

    window.addEventListener("beforeunload", () => {
        saveApplicationDraft();
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

    const previousServiceId = selectedService?.id;

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

    if (
        previousServiceId &&
        String(previousServiceId) !== String(service.id)
    ) {
        clearApplicationDraft();

        if (form) {
            form.reset();
        }
    }

    saveApplicationDraft();

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
          This is not a verified payment.
          Do not use this flag as proof of a real payment.
        */

        demoPaymentCompleted = true;

        saveApplicationDraft();

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

        const previousValue = select.value;

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

        if (states.includes(previousValue)) {
            select.value = previousValue;
        }

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
        !formData.alternative_phone ||
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

    const button = form.querySelector(
        'button[type="submit"]'
    );

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

        /*
          Clear the saved draft only after Supabase
          confirms that the application was inserted.
        */

        clearApplicationDraft();

        showMessage(
            "Application submitted successfully! Your application has been received.",
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

        const payButton = $("btn-pay");

        if (payButton) {
            payButton.disabled = false;
            payButton.textContent = "Pay Now";
        }

        await loadApplications();

    } catch (error) {

        console.error(
            "Application submission error:",
            error
        );

        /*
          Keep the form open and preserve its draft
          whenever submission fails.
        */

        saveApplicationDraft();

        if (form) {
            form.style.display = "block";
        }

        showMessage(
            error.message || "Application submission failed. Your saved information is still available. Please try again.",
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

        saveApplicationDraft();

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

    setupDraftAutoSave();

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

    /*
      Restore the saved form after services have loaded,
      so the saved service can be matched correctly.
    */

    restoreApplicationDraft();

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

    saveApplicationDraft,

    clearApplicationDraft,

    formatCurrency,

    formatDate

};
