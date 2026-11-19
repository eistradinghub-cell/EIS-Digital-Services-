import { supabase } from "./supabase.js";

/* =========================================
   EIS DIGITAL SERVICES
   CUSTOMER DASHBOARD
   PAYSTACK + SUPABASE RPC INTEGRATION
========================================= */

let currentUser = null;
let currentProfile = null;
let currentCustomerName = "";
let selectedService = null;
let servicesCache = [];
let notificationsCache = [];
let currentPaymentReference = null;
let paymentBusy = false;
let applicationModeActive = false;

const $ = id => document.getElementById(id);

const DRAFT_PREFIX = "eis_application_draft_";
const PAYMENT_PREFIX = "eis_verified_payment_";

const PAYSTACK_INITIALIZE_URL = "/api/paystack/initialize";
const PAYSTACK_VERIFY_URL = "/api/paystack/verify";

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

function getDraftKey() {
    return currentUser
        ? `${DRAFT_PREFIX}${currentUser.id}`
        : null;
}

function getPaymentKey() {
    return currentUser
        ? `${PAYMENT_PREFIX}${currentUser.id}`
        : null;
}

function saveApplicationDraft() {
    const key = getDraftKey();

    if (!key || !selectedService) return;

    try {
        const formData = getApplicationFormData();
        const safeFormData = {};

        Object.entries(formData).forEach(([field, value]) => {
            if (!/(bvn|nin|otp|password|passcode|account|card|pin|secret|token)/i.test(field)) {
                safeFormData[field] = value;
            }
        });

        localStorage.setItem(key, JSON.stringify({
            version: 8,
            service_id: selectedService.id,
            service_name: selectedService.name,
            form_data: safeFormData,
            updated_at: new Date().toISOString()
        }));
    } catch (error) {
        console.warn("Draft saving error:", error);
    }
}

function clearApplicationDraft() {
    const key = getDraftKey();

    if (!key) return;

    try {
        localStorage.removeItem(key);
    } catch (error) {
        console.warn("Draft clearing error:", error);
    }
}

function savePaymentReference(reference) {
    const key = getPaymentKey();

    if (!key || !reference) return;

    try {
        // A transaction reference is not an authentication credential.
        // Persist it so an unfinished paid application can resume after reload.
        localStorage.setItem(key, reference);
    } catch (error) {
        console.warn("Payment reference storage error:", error);
    }
}

function getSavedPaymentReference() {
    const key = getPaymentKey();

    if (!key) return null;

    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

function clearPaymentReference() {
    const key = getPaymentKey();

    if (!key) return;

    try {
        localStorage.removeItem(key);
    } catch (error) {
        console.warn("Payment reference clearing error:", error);
    }

    currentPaymentReference = null;
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
   DASHBOARD WELCOME STYLE
========================================= */

function applyDashboardWelcomeStyle() {
    if ($("eis-dashboard-welcome-style")) return;

    const style = document.createElement("style");

    style.id = "eis-dashboard-welcome-style";

    style.textContent = `
        .dashboard-page .dashboard-intro {
            background: linear-gradient(
                118deg,
                #e8f1ff 0%,
                #f1f6ff 48%,
                #dceaff 100%
            ) !important;
            border: 1px solid #c9dcfa !important;
            box-shadow: 0 8px 24px rgba(34,83,145,.10) !important;
        }

        .dashboard-page .dashboard-intro h1 {
            color: #174b91 !important;
        }

        .dashboard-page .dashboard-intro p {
            color: #647c9b !important;
        }

        #pay-section .eis-payment-box {
            padding: 17px;
            margin: 14px 0;
            border: 1px solid #e3e7eb;
            border-radius: 9px;
            background: #fff;
        }

        #pay-section .eis-payment-label {
            color: #697582;
            font-size: 12px;
            margin-bottom: 7px;
        }

        #pay-section .eis-payment-price {
            color: #20665d;
            font-size: 24px;
            font-weight: 800;
        }

        #pay-section .eis-payment-note {
            margin: 14px 0;
            padding: 13px;
            border-radius: 8px;
            background: #edf6f4;
            color: #45665f;
            font-size: 13px;
            line-height: 1.7;
        }

        #pay-section #btn-pay {
            width: 100%;
            min-height: 48px;
            padding: 13px;
            border-radius: 8px;
            font-weight: 700;
        }

        #pay-section #btn-pay:disabled {
            opacity: .65;
            cursor: wait;
        }

        .eis-payment-success {
            padding: 16px;
            margin-top: 15px;
            border: 1px solid #b8e1c8;
            border-radius: 9px;
            background: #effaf3;
            color: #17683a;
            line-height: 1.7;
        }
    `;

    document.head.appendChild(style);
}

/* =========================================
   CUSTOMER PROFILE
========================================= */

function cleanCustomerName(value) {
    if (typeof value !== "string") return "";

    const name = value.replace(/\s+/g, " ").trim();

    if (!name) return "";

    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(name)) {
        return "";
    }

    const placeholders = new Set([
        "customer",
        "user",
        "admin",
        "administrator",
        "unknown",
        "guest",
        "null",
        "undefined",
        "there"
    ]);

    return placeholders.has(name.toLowerCase())
        ? ""
        : name;
}

function joinCustomerName(firstName, lastName) {
    const first = cleanCustomerName(firstName);
    const last = cleanCustomerName(lastName);

    if (!first || !last) return "";

    return `${first} ${last}`.trim();
}

function normalizeCustomerFormData(value) {
    if (!value) return {};

    if (typeof value === "string") {
        try {
            const parsed = JSON.parse(value);

            return parsed &&
                typeof parsed === "object" &&
                !Array.isArray(parsed)
                ? parsed
                : {};

        } catch {
            return {};
        }
    }

    return typeof value === "object" &&
        !Array.isArray(value)
        ? value
        : {};
}

function getCustomerDisplayName(
    profile,
    user,
    applicationFormData = null
) {
    const metadata = user?.user_metadata || {};

    const application =
        normalizeCustomerFormData(applicationFormData);

    const identityData = (user?.identities || [])
        .map(identity => identity?.identity_data || {});

    const sources = [
        profile || {},
        metadata,
        application,
        ...identityData
    ];

    for (const source of sources) {
        const name = joinCustomerName(
            source.first_name ??
            source.firstName ??
            source.given_name ??
            source.givenName,

            source.last_name ??
            source.lastName ??
            source.family_name ??
            source.familyName ??
            source.surname
        );

        if (name) return name;
    }

    const keys = [
        "full_name",
        "fullName",
        "fullname",
        "display_name",
        "displayName",
        "customer_name",
        "customerName",
        "customer_full_name",
        "customerFullName",
        "name"
    ];

    for (const source of sources) {
        for (const key of keys) {
            const name = cleanCustomerName(source?.[key]);

            if (name) return name;
        }
    }

    return "";
}


async function loadUserProfile() {
    applyDashboardWelcomeStyle();

    if (!currentUser) return;

    const welcome = $("welcome");
    const adminButton = $("nav-admin");

    let verifiedRole = "";

    if (adminButton) {
        adminButton.hidden = true;
        adminButton.classList.remove("is-admin-nav");
    }

    try {
        const { data, error } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", currentUser.id)
            .maybeSingle();

        if (error) throw error;

        currentProfile = data || null;

        verifiedRole = String(data?.role || "")
            .trim()
            .toLowerCase();

    } catch (error) {
        console.error("Profile loading error:", error);

        currentProfile = null;
    }

    let displayName = getCustomerDisplayName(
        currentProfile,
        currentUser
    );

    currentCustomerName = displayName;

    if (welcome) {
        welcome.textContent = displayName
            ? `Welcome back, ${displayName}`
            : "Welcome back";
    }

    if (
        ["admin", "super_admin"].includes(verifiedRole) &&
        adminButton
    ) {
        adminButton.hidden = false;
        adminButton.classList.add("is-admin-nav");
    }
}

/* =========================================
   SERVICES
========================================= */

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
    return "Select this service to review the fee and start your application.";
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

        const services = data || [];

        // Keep the loaded services available for payment restoration.
        servicesCache = services;

        container.replaceChildren();

        if (!services.length) {
            container.textContent =
                "There are no services available right now. Please check back later.";

            return;
        }

        services.forEach(service => {
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
            button.textContent = "View service";

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
            "We could not load the services. Refresh the page to try again.";
    }
}

/* =========================================
   SELECT SERVICE
========================================= */

function selectService(service) {
    // Do not allow a paid, unfinished application to be replaced.
    if (!service || paymentBusy || applicationModeActive || currentPaymentReference) return;

    if (
        selectedService &&
        String(selectedService.id) !== String(service.id)
    ) {
        clearApplicationDraft();
        clearPaymentReference();

        $("app-form")?.reset();
    }

    selectedService = service;

    currentPaymentReference = null;

    clearPaymentReference();

    if ($("app-form")) {
        $("app-form").style.display = "none";
    }

    saveApplicationDraft();

    renderPaymentReview();

    $("pay-section")?.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });
}

/* =========================================
   PAYMENT REVIEW
========================================= */

function renderPaymentReview() {
    const section = $("pay-section");

    if (!section || !selectedService) return;

    section.style.display = "block";

    section.innerHTML = `
        <h3>Payment summary</h3>

        <div class="eis-payment-box">
            <div class="eis-payment-label">
                SERVICE
            </div>

            <h4 style="margin:0 0 15px;">
                ${escapeHTML(selectedService.name || "Service")}
            </h4>

            <div class="eis-payment-label">
                AMOUNT DUE
            </div>

            <div class="eis-payment-price">
                ${formatCurrency(selectedService.price)}
            </div>
        </div>

        <div class="eis-payment-note">
            You'll be taken to Paystack to complete your payment securely. Once your payment is confirmed, your application form will open here.
        </div>

        <button
            id="btn-pay"
            type="button"
            class="btn btn-primary"
        >
            Pay securely with Paystack
        </button>

        <p id="pay-msg" class="msg" aria-live="polite"></p>
    `;

    $("btn-pay")?.addEventListener("click", initializePayment);
}

/* =========================================
   INITIALIZE PAYSTACK PAYMENT
========================================= */

async function initializePayment() {
    if (paymentBusy || !currentUser || !selectedService) {
        return;
    }

    const button = $("btn-pay");

    paymentBusy = true;

    if (button) {
        button.disabled = true;
        button.textContent = "Opening secure checkout...";
    }

    try {
        const {
            data: { session },
            error: sessionError
        } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        const accessToken = session?.access_token;

        if (!accessToken) {
            throw new Error("Your session has expired. Please sign in again.");
        }

        const response = await fetch(PAYSTACK_INITIALIZE_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                service_id: selectedService.id
            })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(
                result.error || "Unable to initialize payment."
            );
        }

        if (
            typeof result.authorization_url !== "string" ||
            !result.authorization_url.startsWith("https://")
        ) {
            throw new Error("Invalid payment checkout address.");
        }

        window.location.assign(result.authorization_url);

    } catch (error) {
        console.error("Payment initialization error:", error);

        showMessage(
            error.message || "We could not start the payment. Check your connection and try again.",
            "err"
        );

        if (button) {
            button.disabled = false;
            button.textContent = "Try again";
        }

    } finally {
        paymentBusy = false;
    }
}

/* =========================================
   VERIFY PAYSTACK PAYMENT
========================================= */

async function verifyPayment(reference) {
    if (
        typeof reference !== "string" ||
        !/^EIS[-_][a-f0-9]{32}$/i.test(reference)
    ) {
        throw new Error("Invalid payment reference.");
    }

    const {
        data: { session },
        error: sessionError
    } = await supabase.auth.getSession();

    if (sessionError) throw sessionError;

    const accessToken = session?.access_token;

    if (!accessToken) {
        throw new Error("Please sign in again to verify your payment.");
    }

    const response = await fetch(PAYSTACK_VERIFY_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({
            reference
        })
    });

    const result = await response.json();

    if (
        !response.ok ||
        !result.success ||
        result.verified !== true
    ) {
        throw new Error(
            result.error || "Payment verification was unsuccessful."
        );
    }

    if (
        result.reference !== reference ||
        typeof result.service_name !== "string"
    ) {
        throw new Error("Payment verification response is invalid.");
    }

    return result;
}

/* =========================================
   RESTORE VERIFIED PAYMENT
========================================= */

async function restoreApplicationFormData(formData = {}) {
    const form = $("app-form");
    if (!form || !formData || typeof formData !== "object") return;

    const aliases = { firstName: "first_name", lastName: "last_name" };
    const sensitive = /(bvn|nin|otp|password|passcode|account|card|pin|secret|token)/i;

    Array.from(form.elements).forEach(field => {
        if (!field.name || field.disabled) return;
        if (sensitive.test(field.name) || sensitive.test(field.id || "")) return;

        const savedValue = formData[field.name] ??
            formData[aliases[field.name]] ??
            formData[field.id];

        if (savedValue === undefined || savedValue === null) return;

        if (field.type === "checkbox") {
            field.checked = Boolean(savedValue);
        } else if (field.type === "radio") {
            field.checked = String(field.value) === String(savedValue);
        } else if (field.type !== "file" && field.type !== "password") {
            field.value = String(savedValue);
        }
    });
}

function applyApplicationProtectionStyles() {
    if ($("eis-application-protection-styles")) return;

    const style = document.createElement("style");
    style.id = "eis-application-protection-styles";
    style.textContent = [
        "body.eis-application-mode::before{content:'';position:fixed;inset:0;z-index:9998;background:rgba(13,29,48,.66);-webkit-backdrop-filter:blur(5px);backdrop-filter:blur(5px)}",
        "body.eis-application-mode #app-form.eis-application-active{display:block!important;position:fixed!important;top:50%!important;left:50%!important;z-index:9999!important;width:min(760px,calc(100vw - 24px))!important;max-height:calc(100vh - 24px)!important;max-height:calc(100dvh - 24px)!important;margin:0!important;overflow:auto!important;overscroll-behavior:contain;transform:translate(-50%,-50%)!important;border:1px solid #dce7e5!important;border-radius:16px!important;background:#fff!important;box-shadow:0 24px 80px rgba(0,0,0,.28)!important;padding:24px!important;-webkit-overflow-scrolling:touch}",
        "#app-form .eis-form-protection-notice{display:flex;align-items:flex-start;gap:10px;margin:0 0 18px;padding:13px 14px;border:1px solid #cfe8df;border-radius:10px;background:#f0faf6;color:#245e50;font-size:13px;line-height:1.6}",
        "#app-form .eis-form-protection-notice strong{display:block;margin-bottom:2px;color:#174f43}",
        "@media(max-width:600px){body.eis-application-mode #app-form.eis-application-active{width:calc(100vw - 16px)!important;max-height:calc(100vh - 16px)!important;max-height:calc(100dvh - 16px)!important;padding:17px!important;border-radius:13px!important}}"
    ].join("\n");
    document.head.appendChild(style);
}

function activateApplicationMode() {
    const form = $("app-form");
    if (!form || applicationModeActive) return;

    applyApplicationProtectionStyles();
    applicationModeActive = true;
    form.style.display = "block";
    form.classList.add("eis-application-active");
    form.setAttribute("role", "dialog");
    form.setAttribute("aria-modal", "true");
    form.setAttribute("aria-label", "Complete your paid service application");
    document.body.classList.add("eis-application-mode");

    if (!$("eis-form-protection-notice")) {
        const notice = document.createElement("div");
        notice.id = "eis-form-protection-notice";
        notice.className = "eis-form-protection-notice";
        notice.innerHTML = '<span><strong>Payment confirmed</strong>Your payment has been received. Complete the form below to submit your application. Your progress is saved on this device while you work.</span>';
        const heading = form.querySelector("h2");
        if (heading) heading.insertAdjacentElement("afterend", notice);
        else form.prepend(notice);
    }

    window.history.pushState(
        { ...(window.history.state || {}), eisApplicationForm: true },
        "",
        window.location.href
    );
}

function deactivateApplicationMode() {
    applicationModeActive = false;
    document.body.classList.remove("eis-application-mode");

    const form = $("app-form");
    if (form) {
        form.classList.remove("eis-application-active");
        form.removeAttribute("role");
        form.removeAttribute("aria-modal");
        form.removeAttribute("aria-label");
    }
}

window.addEventListener("beforeunload", event => {
    if (!applicationModeActive) return;
    event.preventDefault();
    event.returnValue = "";
});

window.addEventListener("popstate", () => {
    if (!applicationModeActive) return;
    window.history.pushState(
        { ...(window.history.state || {}), eisApplicationForm: true },
        "",
        window.location.href
    );
});

async function restoreVerifiedPayment(reference) {
    const section = $("pay-section");

    if (section) {
        section.style.display = "block";

        section.innerHTML = `
            <h3>Confirming your payment</h3>
            <p id="pay-msg" class="msg info" style="display:block;">
                This usually takes a few moments. Please keep this page open while we check your payment.
            </p>
        `;
    }

    try {
        const result = await verifyPayment(reference);

        currentPaymentReference = result.reference;

        savePaymentReference(result.reference);

        const matchingService = servicesCache.find(service =>
            String(service.name).trim() ===
            String(result.service_name).trim()
        );

        selectedService = matchingService || {
            id: null,
            name: result.service_name,
            price: result.amount
        };

        if (section) {
            section.innerHTML = `
                <h3>Payment confirmed</h3>

                <div class="eis-payment-success">
                    <strong>Your payment has been confirmed.</strong>

                    <p>
                        Service
                        ${escapeHTML(result.service_name)}
                    </p>

                    <p>
                        Amount paid
                        ${formatCurrency(result.amount)}
                    </p>

                    <p>
                        Payment reference
                        ${escapeHTML(result.reference)}
                    </p>

                    <p>
                        Your application form is ready. Complete the details below to submit your request.
                    </p>
                </div>
            `;

            section.style.display = "block";
        }

        if ($("app-form")) {
            const form = $("app-form");
            const heading = form.querySelector("h2");

            if (heading) {
                heading.textContent = String(selectedService.name || "Service") + " application";
            }

            form.style.display = "block";

            let savedFormData = {};
            try {
                const draft = JSON.parse(localStorage.getItem(getDraftKey()) || "{}");
                savedFormData = draft.form_data || {};
            } catch (error) {
                console.warn("Saved form data could not be read:", error);
            }

            restoreApplicationFormData(savedFormData);
            activateApplicationMode();

            form.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        }

        saveApplicationDraft();

        showMessage(
            "Payment confirmed. Complete the form below to submit your application.",
            "ok",
            "form-msg"
        );

        return true;

    } catch (error) {
        console.error("Payment verification error:", error);

        currentPaymentReference = null;

        if ($("app-form")) {
            $("app-form").style.display = "none";
        }

        showMessage(
            error.message ||
            "We have not been able to confirm this payment yet. Try again in a moment or contact support if you have already been charged.",
            "err",
            "pay-msg"
        );

        return false;
    }
}

/* =========================================
   HANDLE PAYSTACK CALLBACK
========================================= */

async function handlePaymentReturn() {
    const url = new URL(window.location.href);

    const urlReference =
        url.searchParams.get("reference") ||
        url.searchParams.get("trxref");

    const savedReference = getSavedPaymentReference();

    const reference = urlReference || savedReference;

    if (!reference) return;

    if (urlReference) {
        savePaymentReference(urlReference);

        url.searchParams.delete("reference");
        url.searchParams.delete("trxref");

        window.history.replaceState(
            {},
            document.title,
            url.pathname + url.search + url.hash
        );
    }

    await restoreVerifiedPayment(reference);
}

/* =========================================
   APPLICATION FORM DATA
========================================= */

function getApplicationFormData() {
    const data = {};
    const form = $("app-form");
    if (!form) return data;

    // Collect every submitted field. Sensitive values are sent only with the
    // paid application and are excluded separately from browser draft storage.
    Array.from(form.elements).forEach(field => {
        if (
            !field.name ||
            field.disabled ||
            ["button", "submit", "reset", "file", "password"].includes(field.type)
        ) return;

        if (field.type === "checkbox") {
            data[field.name] = Boolean(field.checked);
        } else if (field.type === "radio") {
            if (field.checked) data[field.name] = field.value;
        } else {
            data[field.name] = String(field.value ?? "").trim();
        }
    });

    // Keep the existing submission validation contract.
    data.first_name = data.agent_first_name || "";
    data.last_name = data.last_name || "";
    data.email = data.email || "";
    data.phone = data.phone || "";

    return data;
}

async function sendApplicationReceipt(applicationId) {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;

    const accessToken = session?.access_token;
    if (!accessToken) throw new Error("Your session has expired.");

    const response = await fetch("/api/application-receipt", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ application_id: applicationId })
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.success !== true) {
        throw new Error(result.error || "Receipt email could not be sent.");
    }
    return true;
}

/* =========================================
   APPLICATION STATUS BADGE
========================================= */

function createStatusBadge(status) {
    const badge = document.createElement("span");

    const value = String(status || "In review").trim();

    badge.className =
        `status-badge ${value.toLowerCase().replace(/\s+/g, "_")}`;

    badge.textContent = value;

    return badge;
}

/* =========================================
   LOAD APPLICATIONS
========================================= */

async function loadApplications() {
    const container = $("apps-list");

    if (!currentUser || !container) return;

    container.replaceChildren();

    try {
        const { data, error } = await supabase
            .from("applications")
            .select("id,user_id,service_name,amount,status,created_at,applicant_name")
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
                cleanCustomerName(application.applicant_name) ||
                currentCustomerName ||
                getCustomerDisplayName(currentProfile, currentUser) ||
                "Customer";

            const reference = document.createElement("td");

            // Show the complete application reference so the admin can
            // search for this exact application from the Applications dashboard.
            const rawReference = String(application.id).toUpperCase();
            reference.textContent = rawReference.startsWith("EIS-")
                ? rawReference
                : `EIS-${rawReference}`;

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
        cell.textContent = "We could not load your applications. Refresh the page to try again.";
        cell.style.textAlign = "center";

        row.appendChild(cell);
        container.appendChild(row);
    }
}

/* =========================================
   NOTIFICATIONS
========================================= */

async function loadNotifications() {
    if (!currentUser) return;

    const list = $("notifications-list");
    const count = $("notification-count");

    if (list) {
        list.textContent = "Checking for notifications...";
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
            list.textContent = "Notifications are temporarily unavailable.";
        }
    }
}

function renderNotifications() {
    const list = $("notifications-list");

    if (!list) return;

    list.replaceChildren();

    if (!notificationsCache.length) {
        const empty = document.createElement("p");

        empty.textContent = "You’re all caught up. New notifications will appear here.";

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
        console.error("Mark notifications as read error:", error);
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

/* =========================================
   SUBMIT APPLICATION
   Uses secure Supabase RPC.
========================================= */

async function submitApplication(event) {
    event.preventDefault();

    const form = $("app-form");

    if (!currentUser || !selectedService) {
        showMessage(
            "Choose a service before submitting your application.",
            "err",
            "form-msg"
        );

        return;
    }

    if (!currentPaymentReference) {
        showMessage(
            "We need to confirm your payment before you can submit this application.",
            "err",
            "form-msg"
        );

        return;
    }

    const formData = getApplicationFormData();

    if (
        !formData.kegow_acc_number ||
        !formData.agent_location_state ||
        !formData.bvn_no ||
        !formData.bank_name ||
        !formData.account_no ||
        !formData.account_name ||
        !formData.agent_first_name ||
        !formData.middle_name ||
        !formData.last_name ||
        !formData.email ||
        !formData.alternative_email ||
        !formData.phone ||
        !formData.alternative_phone_no ||
        !formData.home_address ||
        !formData.state_of_residence ||
        !formData.date_of_birth ||
        !formData.local_govt ||
        !formData.geo_political_zone
    ) {
        showMessage(
            "Please complete all the fields before submitting your application.",
            "err",
            "form-msg"
        );

        return;
    }

    const emailPattern =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(formData.email)) {
        showMessage(
            "Enter an email address in the correct format, for example name@example.com.",
            "err",
            "form-msg"
        );

        return;
    }

    if (!emailPattern.test(formData.alternative_email)) {
        showMessage(
            "Enter the alternative email address in the correct format.",
            "err",
            "form-msg"
        );

        return;
    }

    const accountNumberFields = [
        ["Kegow account number", formData.kegow_acc_number],
        ["Account number", formData.account_no]
    ];

    for (const [label, value] of accountNumberFields) {
        if (!/^\d{10}$/.test(String(value || ""))) {
            showMessage(label + " must contain exactly 10 digits.", "err", "form-msg");
            return;
        }
    }

    const phoneFields = [
        ["Phone number", formData.phone],
        ["Alternative phone number", formData.alternative_phone_no]
    ];

    for (const [label, value] of phoneFields) {
        if (!/^\d{11}$/.test(String(value || ""))) {
            showMessage(label + " must contain exactly 11 digits.", "err", "form-msg");
            return;
        }
    }

    const button = form?.querySelector(
        'button[type="submit"]'
    );

    if (button) {
        button.disabled = true;
        button.textContent = "Submitting application...";
    }

    try {
        const { data, error } = await supabase.rpc(
            "submit_application_with_payment",
            {
                p_payment_reference: currentPaymentReference,
                p_form_data: formData
            }
        );

        if (error) {
            if (error.code === "23505") {
                const detail = String(error.message || error.details || "");
                if (/email/i.test(detail)) {
                    throw new Error("This email address has already been used. Please enter a different email address.");
                }
                if (/phone/i.test(detail)) {
                    throw new Error("This phone number has already been used. Please enter a different phone number.");
                }
                throw new Error("This email address or phone number has already been used. Please enter new contact details.");
            }
            throw error;
        }

        if (!data) {
            throw new Error(
                "We could not confirm that your application was submitted. Please try again."
            );
        }

        // The application is already safely stored. Send the email receipt
        // separately so an email-provider issue never reverses a valid submission.
        let receiptEmailSent = false;
        try {
            receiptEmailSent = await sendApplicationReceipt(data);
        } catch (emailError) {
            console.warn("Application receipt email could not be sent:", emailError);
        }

        clearApplicationDraft();
        clearPaymentReference();

        currentPaymentReference = null;
        selectedService = null;

        deactivateApplicationMode();
        form.reset();
        form.style.display = "none";

        if ($("pay-section")) {
            $("pay-section").style.display = "none";
        }

        showMessage(
            receiptEmailSent
                ? "Your application has been received successfully. A confirmation email has been sent to the email address you provided. You can follow its progress under Your applications."
                : "Your application has been submitted successfully. You can follow its progress under Your applications. We could not send the confirmation email right now.",
            "ok",
            "form-msg"
        );

        await loadApplications();

    } catch (error) {
        console.error("Application submission error:", error);

        showMessage(
            error.message ||
            "We could not submit your application. Check your connection and try again.",
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

/* =========================================
   LOGOUT
========================================= */

async function logoutUser() {
    if (applicationModeActive) {
        showMessage(
            "Complete and submit your paid application before leaving this page.",
            "err",
            "form-msg"
        );
        return;
    }

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

/* =========================================
   RESTORE APPLICATION DRAFT
   Drafts NEVER grant payment access.
========================================= */

function restoreApplicationDraft() {
    const key = getDraftKey();

    if (!key) return;

    try {
        const stored = localStorage.getItem(key);

        if (!stored) return;

        const draft = JSON.parse(stored);

        if (!draft || ![7, 8].includes(draft.version)) {
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
        restoreApplicationFormData(draft.form_data || {});

        renderPaymentReview();

    } catch (error) {
        console.error("Draft restoration error:", error);

        clearApplicationDraft();
    }
}

/* =========================================
   INITIALIZE DASHBOARD
========================================= */

async function initializeDashboard() {
    const authenticated = await checkUserSession();

    if (!authenticated) return;

    setupNotificationDropdown();

    const form = $("app-form");

    if (form) {
        form.addEventListener(
            "submit",
            submitApplication
        );

        // Keep account and phone fields numeric and enforce their exact lengths.
        form.addEventListener("input", event => {
            const numericLimits = {
                kegow_acc_number: 10,
                account_no: 10,
                phone: 11,
                alternative_phone_no: 11
            };
            const field = event.target;
            const limit = numericLimits[field?.name];
            if (limit) {
                field.value = field.value.replace(/\D/g, "").slice(0, limit);
            }
            saveApplicationDraft();
        });
        form.addEventListener("change", saveApplicationDraft);

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

    // Verify Paystack callback only after services and session load.
    await handlePaymentReturn();
}

/* =========================================
   AUTH STATE
========================================= */

supabase.auth.onAuthStateChange(event => {
    if (event === "SIGNED_OUT") {
        window.location.replace("index.html");
    }
});

initializeDashboard();

/* =========================================
   PUBLIC DASHBOARD METHODS
========================================= */

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
    verifyPayment
};
