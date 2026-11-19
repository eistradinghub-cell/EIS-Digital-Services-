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


/* =========================================
   PROFILE & ACCOUNT SETTINGS
========================================= */
function setProfileSettingsMessage(targetId, message, type = "success") {
    const element = $(targetId);
    if (!element) return;
    element.textContent = message;
    element.dataset.state = type;
}

function populateProfileSettings() {
    if (!currentUser) return;
    const email = $("profile-account-email");
    const fullName = $("profile-full-name");
    const phone = $("profile-phone");
    if (email) email.value = currentUser.email || "";
    if (fullName) fullName.value = currentProfile?.full_name || currentCustomerName || "";
    if (phone) phone.value = currentProfile?.phone || "";
    ["full_name", "phone"].forEach(field => {
        const input = $(field === "full_name" ? "profile-full-name" : "profile-phone");
        const action = document.querySelector('[data-profile-edit="' + field + '"]');
        if (input) input.readOnly = true;
        if (action) action.textContent = "Edit";
    });
}

async function saveProfileField(field, button) {
    if (!currentUser || !["full_name", "phone"].includes(field)) return;
    const input = $(field === "full_name" ? "profile-full-name" : "profile-phone");
    const value = input?.value.trim() || "";
    if (field === "full_name" && !value) {
        setProfileSettingsMessage("profile-details-message", "Please enter your full name.", "error");
        input?.focus();
        return;
    }
    if (field === "phone" && value && !/^[+()\\d\\s.-]{7,20}$/.test(value)) {
        setProfileSettingsMessage("profile-details-message", "Enter a valid phone number.", "error");
        input?.focus();
        return;
    }

    button.disabled = true;
    button.textContent = "Saving...";
    try {
        const update = field === "full_name" ? { full_name: value } : { phone: value || null };
        const { data, error } = await supabase
            .from("profiles")
            .update(update)
            .eq("id", currentUser.id)
            .select("id, full_name, phone")
            .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("Your profile could not be updated. Please refresh and try again.");

        currentProfile = { ...(currentProfile || {}), ...data };
        if (field === "full_name") {
            currentCustomerName = data.full_name || value;
            const welcome = $("welcome");
            if (welcome) welcome.textContent = "Welcome back, " + currentCustomerName;
        }
        input.readOnly = true;
        button.textContent = "Edit";
        setProfileSettingsMessage("profile-details-message", field === "full_name" ? "Your full name has been saved." : "Your phone number has been saved.");
    } catch (error) {
        console.error("Profile field update error:", error);
        setProfileSettingsMessage("profile-details-message", error.message || "We could not save your changes. Please try again.", "error");
        button.textContent = "Save";
    } finally {
        button.disabled = false;
    }
}

function getPasswordStrength(password) {
    return {
        length: password.length >= 12,
        upper: /[A-Z]/.test(password),
        lower: /[a-z]/.test(password),
        number: /\d/.test(password),
        symbol: /[^A-Za-z0-9]/.test(password)
    };
}

function updatePasswordStrength() {
    const password = $("profile-new-password")?.value || "";
    const rules = getPasswordStrength(password);
    const passed = Object.values(rules).filter(Boolean).length;
    document.querySelectorAll("[data-password-rule]").forEach(item => {
        const valid = Boolean(rules[item.dataset.passwordRule]);
        item.classList.toggle("is-met", valid);
        item.setAttribute("aria-label", item.textContent + (valid ? ", met" : ", not met"));
    });
    const fill = $("profile-password-strength-fill");
    const label = $("profile-password-strength-label");
    const strength = passed === 5 ? "Strong" : passed >= 3 ? "Getting stronger" : password ? "Weak" : "Password strength";
    if (fill) {
        fill.style.width = (passed * 20) + "%";
        fill.dataset.strength = passed === 5 ? "strong" : passed >= 3 ? "medium" : "weak";
    }
    if (label) label.textContent = strength;
    updatePasswordMatch();
}

function updatePasswordMatch() {
    const password = $("profile-new-password")?.value || "";
    const confirmation = $("profile-confirm-password")?.value || "";
    const message = $("profile-password-match");
    if (!message) return;
    if (!confirmation) {
        message.textContent = "Re-enter your new password to confirm it.";
        message.dataset.state = "neutral";
    } else if (password === confirmation) {
        message.textContent = "Passwords match.";
        message.dataset.state = "success";
    } else {
        message.textContent = "Passwords do not match.";
        message.dataset.state = "error";
    }
}

async function updateAccountPassword(event) {
    event.preventDefault();
    if (!currentUser) return;

    const button = $("profile-password-save");
    const currentPassword = $("profile-current-password")?.value || "";
    const password = $("profile-new-password")?.value || "";
    const confirmation = $("profile-confirm-password")?.value || "";

    if (!currentPassword) {
        setProfileSettingsMessage("profile-password-message", "Enter your current password to continue.", "error");
        $("profile-current-password")?.focus();
        return;
    }
    const rules = getPasswordStrength(password);
    if (!Object.values(rules).every(Boolean)) {
        setProfileSettingsMessage("profile-password-message", "Your new password does not meet all the strength requirements.", "error");
        $("profile-new-password")?.focus();
        return;
    }
    if (password === currentPassword) {
        setProfileSettingsMessage("profile-password-message", "Your new password must be different from your current password.", "error");
        $("profile-new-password")?.focus();
        return;
    }
    if (password !== confirmation) {
        setProfileSettingsMessage("profile-password-message", "The new passwords do not match. Please check and try again.", "error");
        $("profile-confirm-password")?.focus();
        return;
    }

    button.disabled = true;
    button.textContent = "Updating...";
    try {
        const { error } = await supabase.auth.updateUser({
            current_password: currentPassword,
            password
        });
        if (error) throw error;

        $("profile-password-form")?.reset();
        updatePasswordStrength();
        setProfileSettingsMessage("profile-password-message", "Your password has been updated successfully.");
    } catch (error) {
        console.error("Password update error:", error);
        const message = /current password|password.*(incorrect|invalid)|invalid.*password/i.test(error.message || "")
            ? "Your current password is incorrect. Please check it and try again."
            : error.message || "We could not update your password. Please try again.";
        setProfileSettingsMessage("profile-password-message", message, "error");
    } finally {
        button.disabled = false;
        button.textContent = "Update password";
    }
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
   CUSTOMER APPLICATION OVERVIEW
========================================= */

function updateApplicationOverview(applications) {
    const counts = {
        total: applications.length,
        pending: 0,
        processing: 0,
        completed: 0
    };

    applications.forEach(application => {
        const status = String(application.status || "").trim().toLowerCase().replace(/[ -]+/g, "_");

        if (["pending", "submitted", "awaiting_review", "awaiting_approval"].includes(status)) {
            counts.pending += 1;
        } else if (["processing", "in_review", "under_review", "in_progress", "review"].includes(status)) {
            counts.processing += 1;
        } else if (["completed", "approved", "resolved"].includes(status)) {
            counts.completed += 1;
        }
    });

    Object.entries(counts).forEach(([key, value]) => {
        const element = $("stat-" + key);
        if (element) element.textContent = String(value);
    });
}


/* =========================================
   LOAD PAYMENT HISTORY
========================================= */

async function loadPaymentHistory() {
    const container = $("payments-list");
    if (!currentUser || !container) return;

    container.replaceChildren();

    try {
        const { data, error } = await supabase
            .from("payments")
            .select("id,reference,service_name,amount,status,created_at")
            .eq("user_id", currentUser.id)
            .order("created_at", { ascending: false });

        if (error) throw error;

        if (!data?.length) {
            const row = document.createElement("tr");
            const cell = document.createElement("td");
            cell.colSpan = 6;
            cell.className = "table-message";
            cell.textContent = "No payments found.";
            row.appendChild(cell);
            container.appendChild(row);
            return;
        }

        data.forEach(payment => {
            const row = document.createElement("tr");

            const reference = document.createElement("td");
            reference.textContent = payment.reference || "—";

            const service = document.createElement("td");
            service.textContent = payment.service_name || "—";

            const date = document.createElement("td");
            date.textContent = formatDate(payment.created_at);

            const amount = document.createElement("td");
            amount.textContent = formatCurrency(payment.amount);

            const status = document.createElement("td");
            const badge = document.createElement("span");
            const rawStatus = String(payment.status || "pending").trim().toLowerCase();
            const paid = ["successful", "success", "used", "paid"].includes(rawStatus);
            const displayStatus = paid
                ? "Paid"
                : rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1);
            badge.className = "status-badge " + (paid ? "completed" : rawStatus.replace(/\s+/g, "_"));
            badge.textContent = displayStatus;
            status.appendChild(badge);

            const receipt = document.createElement("td");
            if (paid) {
                const receiptButton = document.createElement("button");
                receiptButton.type = "button";
                receiptButton.className = "payment-receipt-button";
                receiptButton.textContent = "Download receipt";
                receiptButton.setAttribute("aria-label", "Download receipt for payment " + (payment.reference || ""));
                receiptButton.addEventListener("click", () => downloadPaymentReceipt(payment));
                receipt.appendChild(receiptButton);
            } else {
                const unavailable = document.createElement("span");
                unavailable.className = "receipt-unavailable";
                unavailable.textContent = "Available when paid";
                receipt.appendChild(unavailable);
            }

            row.append(reference, service, date, amount, status, receipt);
            container.appendChild(row);
        });
    } catch (error) {
        console.error("Payment history loading error:", error);

        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 6;
        cell.className = "table-message";
        cell.textContent = "We could not load your payment history. Refresh the page to try again.";
        row.appendChild(cell);
        container.appendChild(row);
    }
}

/* =========================================
   PRINTABLE PAYMENT RECEIPT
   Only successful/paid payment records qualify.
========================================= */

function downloadPaymentReceipt(payment) {
    const paidStatuses = ["successful", "success", "used", "paid"];
    const status = String(payment?.status || "").trim().toLowerCase();

    if (!payment || !paidStatuses.includes(status)) {
        alert("A receipt is available only after payment has been confirmed.");
        return;
    }

    const receiptWindow = window.open("", "_blank");
    if (!receiptWindow) {
        alert("Please allow pop-ups for this website, then try again.");
        return;
    }

    const escapeHtml = value => String(value ?? "—").replace(/[&<>"']/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);

    const reference = escapeHtml(payment.reference);
    const service = escapeHtml(payment.service_name);
    const date = escapeHtml(formatDate(payment.created_at));
    const amount = escapeHtml(formatCurrency(payment.amount));
    const issuedAt = escapeHtml(new Date().toLocaleString());

    receiptWindow.document.open();
    receiptWindow.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Payment receipt | EIS Digital Services</title>
<style>
*{box-sizing:border-box}
body{margin:0;padding:32px;background:#f4f6f6;color:#26343d;font-family:Arial,Helvetica,sans-serif}
.receipt{max-width:680px;margin:24px auto;padding:42px;background:#fff;border:1px solid #e1e6e8}
.brand{font-size:20px;font-weight:700;letter-spacing:.2px}
.brand span{display:block;margin-top:5px;color:#6a777e;font-size:11px;font-weight:400;letter-spacing:1px;text-transform:uppercase}
.rule{height:3px;margin:28px 0;background:#287b70}
h1{margin:0 0 8px;font-size:25px}
.intro{margin:0;color:#697780;font-size:13px;line-height:1.6}
.paid{display:inline-block;margin:25px 0 8px;padding:7px 12px;border:1px solid #cce5d8;border-radius:4px;background:#eff8f2;color:#246b43;font-size:12px;font-weight:700;letter-spacing:.5px}
dl{margin:18px 0 0}
dl div{display:flex;justify-content:space-between;gap:20px;padding:15px 0;border-bottom:1px solid #edf0f1}
dt{color:#6b7880;font-size:13px}
dd{margin:0;color:#26343d;font-size:13px;font-weight:600;text-align:right;overflow-wrap:anywhere}
.total{margin-top:22px;padding:18px;background:#f6f8f8}
.total span{display:block;color:#68757c;font-size:12px}
.total strong{display:block;margin-top:7px;font-size:25px}
.footer{margin-top:30px;padding-top:17px;border-top:1px solid #e6eaeb;color:#748087;font-size:11px;line-height:1.7}
.actions{max-width:680px;margin:0 auto;text-align:right}
button{padding:11px 18px;border:0;border-radius:5px;background:#287b70;color:#fff;font-weight:600;cursor:pointer}
@media(max-width:560px){body{padding:12px}.receipt{margin:8px auto;padding:24px 19px}.actions{padding:0 4px}}
@media print{body{padding:0;background:#fff}.receipt{max-width:none;margin:0;padding:32px;border:0}.actions{display:none}}
</style>
</head>
<body>
<main class="receipt">
<div class="brand">EIS Digital Services<span>Payment confirmation</span></div>
<div class="rule"></div>
<h1>Payment receipt</h1>
<p class="intro">This receipt confirms a payment recorded by EIS Digital Services.</p>
<div class="paid">PAYMENT CONFIRMED</div>
<dl>
<div><dt>Payment reference</dt><dd>${reference}</dd></div>
<div><dt>Service</dt><dd>${service}</dd></div>
<div><dt>Payment date</dt><dd>${date}</dd></div>
<div><dt>Status</dt><dd>Paid</dd></div>
</dl>
<div class="total"><span>Amount paid</span><strong>${amount}</strong></div>
<div class="footer">Keep this receipt for your records. If you need help with this payment, contact EIS Digital Services and quote the payment reference above.<br>Receipt prepared: ${issuedAt}</div>
</main>
<div class="actions"><button type="button" onclick="window.print()">Print / Save as PDF</button></div>
<script>window.addEventListener("load",()=>setTimeout(()=>window.print(),300));<\/script>
</body>
</html>`);
    receiptWindow.document.close();
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

        updateApplicationOverview(data || []);

        if (!data?.length) {
            const row = document.createElement("tr");
            const cell = document.createElement("td");

            cell.colSpan = 6;
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

            const action = document.createElement("td");
            const trackButton = document.createElement("button");
            trackButton.type = "button";
            trackButton.className = "application-track-button";
            trackButton.textContent = "Track";
            trackButton.setAttribute("aria-label", "Track application " + rawReference);
            trackButton.addEventListener("click", () => openApplicationTracking(application));
            action.appendChild(trackButton);

            row.append(
                name,
                reference,
                service,
                submitted,
                status,
                action
            );

            container.appendChild(row);
        });

    } catch (error) {
        console.error("Applications loading error:", error);

        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 6;
        cell.textContent = "We could not load your applications. Refresh the page to try again.";
        cell.style.textAlign = "center";

        row.appendChild(cell);
        container.appendChild(row);
    }
}


/* =========================================
   APPLICATION TRACKING
========================================= */

function openApplicationTracking(application) {
    const dialog = $("application-track-dialog");
    const statusBox = $("track-current-status");
    const details = $("track-details");
    const note = $("track-status-note");

    if (!dialog || !statusBox || !details || !note) return;

    const rawReference = String(application.id || "").toUpperCase();
    const reference = rawReference.startsWith("EIS-") ? rawReference : "EIS-" + rawReference;
    const currentStatus = String(application.status || "In review").trim();
    const normalized = currentStatus.toLowerCase().replace(/[ -]+/g, "_");

    statusBox.replaceChildren();
    const label = document.createElement("span");
    label.textContent = "Current status";
    const badge = createStatusBadge(currentStatus);
    statusBox.append(label, badge);

    const fields = [
        ["Reference", reference],
        ["Service", application.service_name || "Service"],
        ["Date submitted", formatDateTime(application.created_at)]
    ];

    details.replaceChildren();
    fields.forEach(([title, value]) => {
        const wrapper = document.createElement("div");
        const term = document.createElement("dt");
        const description = document.createElement("dd");
        term.textContent = title;
        description.textContent = value;
        wrapper.append(term, description);
        details.appendChild(wrapper);
    });

    const messages = {
        pending: "We have received your application. It is waiting to be reviewed.",
        submitted: "We have received your application. It is waiting to be reviewed.",
        in_progress: "Our team is currently working on your application.",
        processing: "Our team is currently working on your application.",
        completed: "Your application has been completed.",
        approved: "Your application has been approved.",
        rejected: "Your application was not approved. Please contact our support team for assistance."
    };

    note.textContent = messages[normalized] ||
        "This is the latest status recorded for your application. Please contact support if you need an update.";

    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
}

function closeApplicationTracking() {
    const dialog = $("application-track-dialog");
    if (!dialog) return;
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
}

["track-dialog-close", "track-dialog-done"].forEach(id => {
    const button = $(id);
    if (button) button.addEventListener("click", closeApplicationTracking);
});

const trackingDialog = $("application-track-dialog");
if (trackingDialog) {
    trackingDialog.addEventListener("click", event => {
        if (event.target === trackingDialog) closeApplicationTracking();
    });
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

    const profileSettingsDialog = $("profile-settings-dialog");
    $("open-profile-settings")?.addEventListener("click", () => {
        if (profileSettingsDialog && !profileSettingsDialog.open) profileSettingsDialog.showModal();
    });
    $("profile-settings-close")?.addEventListener("click", () => profileSettingsDialog?.close());
    profileSettingsDialog?.addEventListener("click", (event) => {
        if (event.target === profileSettingsDialog) profileSettingsDialog.close();
    });

    $("profile-details-form")?.addEventListener("click", event => {
        const button = event.target.closest("[data-profile-edit]");
        if (!button || button.disabled) return;
        const field = button.dataset.profileEdit;
        const input = $(field === "full_name" ? "profile-full-name" : "profile-phone");
        if (!input) return;
        if (input.readOnly) {
            input.readOnly = false;
            button.textContent = "Save";
            setProfileSettingsMessage("profile-details-message", "");
            input.focus();
        } else {
            saveProfileField(field, button);
        }
    });
    $("profile-password-form")?.addEventListener("submit", updateAccountPassword);
    $("profile-new-password")?.addEventListener("input", updatePasswordStrength);
    $("profile-confirm-password")?.addEventListener("input", updatePasswordMatch);

    if ($("pay-section")) {
        $("pay-section").style.display = "none";
    }

    await loadUserProfile();
    populateProfileSettings();

    await Promise.all([
        loadServices(),
        loadApplications(),
        loadPaymentHistory(),
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
    loadPaymentHistory,
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
