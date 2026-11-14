/* =====================================================
   EIS DIGITAL SERVICES
   FILE 5: js/dashboard.js
   Compatible with current dashboard.html and schema
===================================================== */

import { supabase } from "./supabase.js";

/* ===============================
   VARIABLES
================================ */

let currentUser = null;
let selectedService = null;
let servicesCache = [];
let applicationsCache = [];

const $ = (id) => document.getElementById(id);


/* ===============================
   MESSAGES
================================ */

function showMessage(message, type = "info") {
    const box =
        $("dashboard-message") ||
        $("pay-msg") ||
        $("form-msg");

    if (!box) {
        alert(message);
        return;
    }

    box.textContent = message;
    box.className = `msg ${type}`;
}


/* ===============================
   FORMAT
================================ */

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

    return value.toLocaleDateString("en-NG");
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


/* ===============================
   LOAD PROFILE
================================ */

async function loadUserProfile() {
    if (!currentUser) return;

    const welcome = $("welcome");

    if (welcome) {
        welcome.textContent =
            `Welcome, ${currentUser.email}`;
    }

    try {
        const { data, error } = await supabase
            .from("profiles")
            .select("full_name,email,phone")
            .eq("id", currentUser.id)
            .maybeSingle();

        if (error) throw error;

        if (data && welcome) {
            welcome.textContent =
                `Welcome, ${data.full_name || currentUser.email}`;
        }

    } catch (error) {
        console.error("Profile error:", error);
    }
}


/* ===============================
   LOAD SERVICES
================================ */

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
            price.textContent =
                formatCurrency(service.price);

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


/* ===============================
   SELECT SERVICE
================================ */

function selectService(service) {
    selectedService = service;

    const form = $("app-form");

    if (form) {
        form.style.display = "block";

        form.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }

    showMessage(
        `Selected service: ${service.name}`,
        "ok"
    );
}


/* ===============================
   SAFE APPLICATION FORM
================================ */

function prepareApplicationForm() {
    const form = $("app-form");

    if (!form) return;

    /*
      Hide sensitive fields during testing.
      Never collect real BVN, bank account details,
      passwords, PINs or card details here.
    */

    const sensitiveFields = [
        "f-bvn",
        "f-bankName",
        "f-accountNo",
        "f-accountName",
        "f-address",
        "f-dob",
        "f-kegow"
    ];

    sensitiveFields.forEach(id => {
        const field = $(id);

        if (field) {
            field.required = false;

            const wrapper = field.closest(".form-grid > div");

            if (wrapper) {
                wrapper.style.display = "none";
            }
        }
    });

    /*
      Populate state dropdowns.
    */

    const states = [
        "Abia", "Adamawa", "Akwa Ibom", "Anambra",
        "Bauchi", "Bayelsa", "Benue", "Borno",
        "Cross River", "Delta", "Ebonyi", "Edo",
        "Ekiti", "Enugu", "FCT", "Gombe",
        "Imo", "Jigawa", "Kaduna", "Kano",
        "Katsina", "Kebbi", "Kogi", "Kwara",
        "Lagos", "Nasarawa", "Niger", "Ogun",
        "Ondo", "Osun", "Oyo", "Plateau",
        "Rivers", "Sokoto", "Taraba",
        "Yobe", "Zamfara"
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


/* ===============================
   LOAD APPLICATIONS
================================ */

async function loadApplications() {
    const container = $("apps-list");

    if (!currentUser || !container) return;

    container.innerHTML = "";

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

            cell.colSpan = 4;
            cell.textContent = "No applications yet.";

            row.appendChild(cell);
            container.appendChild(row);

            return;
        }

        applicationsCache.forEach(application => {

            const row = document.createElement("tr");

            const name = document.createElement("td");
            name.textContent = currentUser.email || "Customer";

            const reference = document.createElement("td");
            reference.textContent =
                String(application.id).slice(0, 8);

            const service = document.createElement("td");
            service.textContent =
                application.service_name || "Service";

            const status = document.createElement("td");
            status.textContent =
                application.status || "Pending";

            row.append(
                name,
                reference,
                service,
                status
            );

            container.appendChild(row);
        });

    } catch (error) {
        console.error("Applications error:", error);

        container.innerHTML = "";

        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 4;
        cell.textContent =
            "Unable to load applications.";

        row.appendChild(cell);
        container.appendChild(row);
    }
}


/* ===============================
   SUBMIT APPLICATION
================================ */

async function submitApplication(event) {
    event.preventDefault();

    const form = $("app-form");

    if (!currentUser) {
        showMessage("Please log in first.", "err");
        return;
    }

    if (!selectedService) {
        showMessage(
            "Please select a service first.",
            "err"
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
            "err"
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
                status: "pending",
                form_data: safeFormData
            }]);

        if (error) throw error;

        showMessage(
            "Application submitted successfully!",
            "ok"
        );

        form.reset();

        selectedService = null;

        form.style.display = "none";

        await loadApplications();

    } catch (error) {
        console.error("Application submission:", error);

        showMessage(
            error.message || "Application submission failed.",
            "err"
        );

    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = "Submit application";
        }
    }
}


/* ===============================
   LOGOUT
================================ */

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


/* ===============================
   INITIALIZE
================================ */

async function initializeDashboard() {

    const authenticated = await checkUserSession();

    if (!authenticated) return;

    prepareApplicationForm();

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

    await loadUserProfile();

    await Promise.all([
        loadServices(),
        loadApplications()
    ]);
}


/* ===============================
   AUTH LISTENER
================================ */

supabase.auth.onAuthStateChange((event) => {

    if (event === "SIGNED_OUT") {
        window.location.replace("index.html");
    }

});


/* ===============================
   START
================================ */

initializeDashboard();


/* ===============================
   GLOBAL
================================ */

window.EISDashboard = {
    loadServices,
    loadApplications,
    loadUserProfile,
    selectService,
    logoutUser
};
