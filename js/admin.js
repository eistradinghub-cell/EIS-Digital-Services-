import { supabase } from "./supabase.js";
const $ = (id) => document.getElementById(id);
let currentUser = null;
let currentProfile = null;
let applicationsCache = [];
let paymentsCache = [];
let customersCache = [];
let customersPage = 1;
let customersTotal = 0;
let customerLoadSequence = 0;
const CUSTOMERS_PAGE_SIZE = 10;
let paymentsPage = 1;
let paymentsTotal = 0;
let paymentLoadSequence = 0;
const PAYMENTS_PAGE_SIZE = 10;
let servicesCache = [];
let conversationsCache = [];
let currentConversation = null;
let conversationLoadSequence = 0;
let chatMessageLoadSequence = 0;
let realtimeChannels = [];
let noticeTimer = null;
let isSendingMessage = false;

function escapeHTML(value) {
return String(value ?? "").replace(/[&<>"']/g, char => ({
"&": "&amp;",
"<": "&lt;",
">": "&gt;",
'"': "&quot;",
"'": "&#039;"
})[char]);
}

function formatCurrency(amount) {
const number = Number(amount || 0);
return "₦" + number.toLocaleString("en-NG", {
minimumFractionDigits: 0,
maximumFractionDigits: 2
});
}

function formatDate(value) {
if (!value) return "Date unavailable";
const date = new Date(value);
if (Number.isNaN(date.getTime())) {
return "Date unavailable";
}
return date.toLocaleString("en-NG", {
dateStyle: "medium",
timeStyle: "short"
});
}

function formatShortDate(value) {
if (!value) return "";
const date = new Date(value);
if (Number.isNaN(date.getTime())) return "";
return date.toLocaleDateString("en-NG", {
day: "numeric",
month: "short",
year: "numeric"
});
}

function normalizeStatus(status) {
return String(status || "In review")
.trim()
.toLowerCase()
.replace(/\s+/g, "_");
}

function showNotice(message, type = "success") {
const notice = $("admin-message");
if (!notice) return;
clearTimeout(noticeTimer);
notice.textContent = message;
notice.className = "admin-notice " + type;
notice.hidden = false;
notice.scrollIntoView({
behavior: "smooth",
block: "nearest"
});
noticeTimer = setTimeout(() => {
notice.hidden = true;
}, 6000);
}

function setLoading(elementId, message = "Loading...") {
const element = $(elementId);
if (!element) return;
element.innerHTML = `
<div class="admin-loading">
${escapeHTML(message)}
</div>
`;
}

function showError(elementId, message) {
const element = $(elementId);
if (!element) return;
element.innerHTML = `
<div class="admin-error">
${escapeHTML(message)}
</div>
`;
}

function showEmpty(elementId, message) {
const element = $(elementId);
if (!element) return;
element.innerHTML = `
<div class="admin-empty">
${escapeHTML(message)}
</div>
`;
}

function getInitials(name) {
const value = String(name || "Admin").trim();
return value
.split(/\s+/)
.slice(0, 2)
.map(part => part.charAt(0).toUpperCase())
.join("") || "A";
}

function getCustomerName(profile, fallback = "Customer") {
return profile?.full_name?.trim() || fallback;
}

function getFormValue(formData, key) {
if (!formData || typeof formData !== "object") {
return "";
}
return formData[key] ?? "";
}

function setupAdminPanelDisclosures() {
  const attachPanels = (root = document) => {
    const selector = ".admin-section .admin-panel:not(.admin-chat-list-panel):not(.admin-chat-window)";
    const candidates = [];

    if (root instanceof Element && root.matches(selector)) {
      candidates.push(root);
    }
    if (root.querySelectorAll) {
      candidates.push(...root.querySelectorAll(selector));
    }

    candidates.forEach(panel => {
      if (panel.dataset.disclosureReady === "true") return;

      const header = panel.querySelector(":scope > .admin-panel-header");
      const titleHeading = header?.querySelector("h2, h3, h4");
      if (!header || !titleHeading) return;

      const title = titleHeading.textContent.trim() || "Panel";
      const sectionKey = panel.closest(".admin-section")?.id || "admin";
      const panelKey = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const storageKey = `eis-admin-panel:${sectionKey}:${panelKey}`;

      const body = document.createElement("div");
      body.className = "admin-panel-content";
      body.id = `admin-panel-content-${sectionKey}-${panelKey}-${document.querySelectorAll(".admin-panel-content").length + 1}`;

      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "admin-panel-toggle";
      toggle.setAttribute("aria-controls", body.id);

      const label = document.createElement("span");
      label.className = "admin-panel-toggle-label";
      label.textContent = title;

      const mark = document.createElement("span");
      mark.className = "admin-panel-toggle-mark";
      mark.setAttribute("aria-hidden", "true");

      toggle.append(label, mark);
      titleHeading.replaceChildren(toggle);

      while (header.nextSibling) body.append(header.nextSibling);
      panel.append(body);

      let expanded = false;
      try {
        expanded = localStorage.getItem(storageKey) === "open";
      } catch (_) {}

      const setExpanded = (value, persist = true) => {
        expanded = value;
        panel.classList.toggle("is-expanded", expanded);
        toggle.setAttribute("aria-expanded", String(expanded));
        body.hidden = !expanded;

        if (persist) {
          try {
            localStorage.setItem(storageKey, expanded ? "open" : "closed");
          } catch (_) {}
        }
      };

      toggle.addEventListener("click", () => setExpanded(!expanded));
      setExpanded(expanded, false);
      panel.dataset.disclosureReady = "true";
    });
  };

  attachPanels();

  if (!window.eisAdminPanelObserver) {
    window.eisAdminPanelObserver = new MutationObserver(records => {
      records.forEach(record => {
        record.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) attachPanels(node);
        });
      });
    });

    window.eisAdminPanelObserver.observe(
      document.querySelector(".admin-content") || document.body,
      { childList: true, subtree: true }
    );
  }
}

async function initializeAdmin() {
try {
const {
data: { session },
error
} = await supabase.auth.getSession();

if (error) throw error;

if (!session?.user) {
window.location.replace("index.html");
return;
}

currentUser = session.user;

const { data: profile, error: profileError } = await supabase
.from("profiles")
.select("id,email,full_name,phone,role")
.eq("id", currentUser.id)
.single();

if (profileError) throw profileError;

if (
!profile ||
!["admin", "super_admin"].includes(
String(profile.role || "").toLowerCase()
)
) {
showNotice(
"Access denied. Administrator permission is required.",
"error"
);
await supabase.auth.signOut();
window.location.replace("index.html");
return;
}

currentProfile = profile;

const isSuperAdmin = String(profile.role || "").toLowerCase() === "super_admin";
const siteSettingsLink = document.querySelector('[data-section="site-settings"]');
const siteSettingsSection = $("section-site-settings");
if (!isSuperAdmin) {
  siteSettingsLink?.remove();
  siteSettingsSection?.remove();
} else {
}

updateAdminIdentity();
setupAdminPanelDisclosures();
updateDate();
setupNavigation();
setupSidebar();
setupEventListeners();
await loadAllDashboardData();

// Restore the last admin section after refresh instead of forcing Overview.
const savedSection = sessionStorage.getItem("eis_admin_current_section");
const allowedSections = new Set([
"overview",
"marketplace",
"applications",
"payments",
"customer-care",
"prices",
"broadcast",
...(isSuperAdmin ? ["site-settings"] : [])
]);
const sectionToRestore = allowedSections.has(savedSection)
? savedSection
: "overview";
openSection(sectionToRestore);

setupRealtime();

console.log("EIS Admin Dashboard initialized.");
} catch (error) {
console.error("Admin initialization error:", error);
showNotice(
error.message || "Unable to initialize admin dashboard.",
"error"
);
}
}

function updateAdminIdentity() {
if (!currentProfile) return;

const name =
currentProfile.full_name ||
currentProfile.email ||
"Administrator";

const email = currentProfile.email || "";
const role = currentProfile.role || "admin";

if ($("sidebar-admin-name")) {
$("sidebar-admin-name").textContent = name;
}

if ($("sidebar-admin-role")) {
$("sidebar-admin-role").textContent = role;
}

if ($("admin-avatar")) {
$("admin-avatar").textContent = getInitials(name);
}

if ($("settings-admin-name")) {
$("settings-admin-name").textContent = name;
}

if ($("settings-admin-email")) {
$("settings-admin-email").textContent = email;
}

if ($("settings-admin-role")) {
$("settings-admin-role").textContent = role;
}

if ($("admin-name")) {
$("admin-name").textContent = name;
}

if ($("admin-email")) {
$("admin-email").textContent = email;
}
}

function updateDate() {
if ($("admin-date")) {
$("admin-date").textContent =
new Date().toLocaleDateString("en-NG", {
weekday: "short",
day: "numeric",
month: "short",
year: "numeric"
});
}

if ($("admin-year")) {
$("admin-year").textContent =
new Date().getFullYear();
}
}

async function loadAllDashboardData() {
await Promise.allSettled([
loadApplications(),
loadServices(),
loadConversations()
]);

renderStatistics();
}

function renderStatistics() {
const total = applicationsCache.length;

const review = applicationsCache.filter(app => {
return [
"in_review",
"in_progress"
].includes(normalizeStatus(app.status));
}).length;

const completed = applicationsCache.filter(app => {
return normalizeStatus(app.status) === "completed";
}).length;

if ($("stat-total")) {
$("stat-total").textContent = total.toLocaleString();
}

if ($("stat-review")) {
$("stat-review").textContent = review.toLocaleString();
}

if ($("stat-completed")) {
$("stat-completed").textContent = completed.toLocaleString();
}

renderRecentApplications();

if ($("applications-badge")) {
const seen = getSeenApplicationIds();
const unreadCount = applicationsCache.filter(app => !seen.has(String(app.id))).length;
$("applications-badge").textContent = unreadCount;
$("applications-badge").style.display = unreadCount ? "inline-flex" : "none";
}

const unread = conversationsCache.reduce((sum, conversation) => {
return sum + Number(conversation.unread_admin_count || 0);
}, 0);

if ($("chat-badge")) {
$("chat-badge").textContent = unread;
}
}

function renderRecentApplications() {
const container = $("admin-recent-applications");
if (!container) return;

const recent = applicationsCache.slice(0, 5);
if (!recent.length) {
showEmpty("admin-recent-applications", "No applications have been received yet.");
return;
}

container.innerHTML = recent.map(app => {
const status = String(app.status || "In review").replace(/_/g, " ");
return `
<article class="admin-recent-item">
<div class="admin-recent-details">
<strong>${escapeHTML(app.service_name || "Service application")}</strong>
<span>${escapeHTML(formatShortDate(app.created_at) || "Date unavailable")}</span>
</div>
<span class="admin-recent-status">${escapeHTML(status)}</span>
</article>
`;
}).join("");
}

async function loadApplications() {
setLoading("applications-full-list", "Loading applications...");

const { data, error } = await supabase
.rpc("admin_list_applications");

if (error) {
console.error("Applications error:", error);
showError("applications-full-list", error.message);
return;
}

// Keep the newest customer submissions first, even if the RPC
// response ordering changes in a future database update.
applicationsCache = (data || []).slice().sort((a, b) => {
const dateA = new Date(a.created_at || 0).getTime();
const dateB = new Date(b.created_at || 0).getTime();
return dateB - dateA;
});
await loadApplicationCustomers();
renderApplications();
if ($("section-applications")?.classList.contains("active")) markApplicationsAsSeen();
renderStatistics();
}

async function loadApplicationCustomers() {
const userIds = [
...new Set(
applicationsCache
.map(app => app.user_id)
.filter(Boolean)
)
];

if (!userIds.length) return;

const { data, error } = await supabase
.rpc("admin_get_application_customers", {
p_user_ids: userIds
});

if (error) {
console.warn("Could not load application customers:", error);
return;
}

const profileMap = new Map(
(data || []).map(profile => [profile.id, profile])
);

applicationsCache = applicationsCache.map(app => ({
...app,
customer: profileMap.get(app.user_id) || null
}));
}

function getApplicationFields(app) {
const fields = [];
const formData = (() => {
if (app.form_data && typeof app.form_data === "object") return app.form_data;
if (typeof app.form_data === "string") {
try { return JSON.parse(app.form_data); } catch { return {}; }
}
return {};
})();
const orderedFields = [
["KEGOW ACC NUMBER:", ["kegow_acc_number", "kegow_acc_number"]],
["AGENT LOCATION STATE:", ["agent_location_state"]],
["BVN NO:", ["bvn_no"]],
["BANK NAME:", ["bank_name"]],
["ACCOUNT NO:", ["account_no"]],
["ACCOUNT NAME:", ["account_name"]],
["AGENT FIRST NAME:", ["agent_first_name"]],
["MIDDLE NAME:", ["middle_name"]],
["LAST NAME:", ["last_name"]],
["EMAIL:", ["email"]],
["ALTERNATIVE EMAIL:", ["alternative_email"]],
["PHONE NO.:", ["phone", "phone_no"]],
["ALTERNATIVE PHONE NO.:", ["alternative_phone_no", "alternative_phone"]],
["HOME ADDRESS:", ["home_address"]],
["STATE OF RESIDENCE:", ["state_of_residence"]],
["DATE OF BIRTH:", ["date_of_birth"]],
["LOCAL GOVT:", ["local_govt", "local_government"]],
["GEO POLITICAL ZONE:", ["geo_political_zone", "geopolitical_zone"]]
];
orderedFields.forEach(([label, keys]) => {
const key = keys.find(name => Object.prototype.hasOwnProperty.call(formData, name));
if (key === undefined) return;
const value = formData[key];
if (value === null || value === undefined || value === "") return;
let display = value;
if (typeof display === "object") {
try { display = JSON.stringify(display, null, 2); }
catch { display = String(display); }
}
fields.push({ label, value: String(display) });
});
return fields;
}

function getApplicationHTML(app) {
const account = app.customer || {};
const accountEmail = account.email || "Account email unavailable";
const savedAccountName = String(account.full_name || "").trim();
const accountName = savedAccountName && savedAccountName.toLowerCase() !== "customer"
? savedAccountName
: accountEmail;
const rawReference = app.reference_id ?? app.application_id ?? app.id ?? "Unavailable";
const reference = formatApplicationReference(rawReference);
const fields = getApplicationFields(app);
const pairs = fields.map(field => [field]);
const options = [
["In review", "In Review"],
["In progress", "In Progress"],
["Completed", "Completed"],
["Rejected", "Rejected"]
];
return `
<article class="admin-app-item admin-application-card" data-application-card="${escapeHTML(app.id)}">
<header class="admin-application-card-head">
<button type="button" class="admin-application-summary" data-toggle-application="${escapeHTML(app.id)}" aria-expanded="false" aria-controls="application-details-${escapeHTML(app.id)}">
<span class="admin-application-title">
<strong class="admin-account-name">${escapeHTML(accountName)}</strong>
<span class="admin-account-email">${escapeHTML(accountEmail)}</span>
<span class="admin-application-reference">Reference: ${escapeHTML(String(reference))}</span>
</span>
<span class="admin-application-summary-meta">
<time>Submitted: ${escapeHTML(formatDate(app.created_at))}</time>
<span class="admin-status ${escapeHTML(normalizeStatus(app.status))}">${escapeHTML(String(app.status || "In review").replace(/_/g, " "))}</span>
<span class="admin-application-expand-mark" aria-hidden="true">+</span>
</span>
</button>
</header>
<div class="admin-application-details" id="application-details-${escapeHTML(app.id)}" hidden>
<div class="admin-application-fields">
${pairs.map(pair => `
<div class="admin-application-row">
${pair.map(field => field ? `
<div class="admin-application-field">
<span class="admin-application-label">${escapeHTML(field.label)}</span>
<strong class="admin-application-value">${escapeHTML(field.value)}</strong>
<button type="button" class="admin-copy-button" data-copy-value="${escapeHTML(field.value)}" aria-label="Copy ${escapeHTML(field.label)}">Copy</button>
</div>` : '<div class="admin-application-field admin-application-field-empty"></div>').join("")}
</div>`).join("")}
</div>
<footer class="admin-application-card-foot">
<div class="admin-application-status-control">
<label for="application-status-${escapeHTML(app.id)}">Status:</label>
<select id="application-status-${escapeHTML(app.id)}" class="admin-status-select" data-app-status="${escapeHTML(app.id)}" aria-label="Change application status">
${options.map(([value, label]) => `
<option value="${escapeHTML(value)}" ${String(app.status || "In review").toLowerCase() === value.toLowerCase() ? "selected" : ""}>${label}</option>
`).join("")}
</select>
<button type="button" class="admin-primary-button admin-save-status" data-save-app-status="${escapeHTML(app.id)}">Save Status</button>
</div>
<button type="button" class="admin-copy-all-button" data-copy-application="${escapeHTML(app.id)}">Copy All Information</button>
</footer>
</div>
</article>`;
}

function getSeenApplicationIds() {
try {
const saved = JSON.parse(localStorage.getItem("eis_admin_seen_application_ids") || "[]");
return new Set(Array.isArray(saved) ? saved.map(String) : []);
} catch { return new Set(); }
}

function markApplicationsAsSeen() {
const seen = getSeenApplicationIds();
applicationsCache.forEach(app => {
if (app?.id !== null && app?.id !== undefined) seen.add(String(app.id));
});
try {
localStorage.setItem("eis_admin_seen_application_ids", JSON.stringify([...seen]));
} catch (error) {
console.warn("Could not save application read state:", error);
}
renderStatistics();
}

async function copyTextToClipboard(value, button = null) {
const originalText = button?.textContent || "Copy";
const originalScrollX = window.scrollX;
const originalScrollY = window.scrollY;

try {
if (navigator.clipboard && window.isSecureContext) {
await navigator.clipboard.writeText(String(value));
} else {
const input = document.createElement("textarea");
input.value = String(value);
input.setAttribute("readonly", "");
input.style.position = "fixed";
input.style.top = "0";
input.style.left = "-9999px";
input.style.width = "1px";
input.style.height = "1px";
input.style.opacity = "0";
document.body.appendChild(input);
input.focus({ preventScroll: true });
input.select();
input.setSelectionRange(0, input.value.length);
const copied = document.execCommand("copy");
input.remove();
if (!copied) throw new Error("Copy command was not successful.");
}

if (button) {
button.textContent = "Copied ✓";
button.classList.add("is-copied");
button.setAttribute("aria-label", "Copied successfully");
clearTimeout(button._copyResetTimer);
button._copyResetTimer = setTimeout(() => {
if (!button.isConnected) return;
button.textContent = originalText;
button.classList.remove("is-copied");
button.removeAttribute("aria-label");
}, 1800);
}
} catch (error) {
console.error("Copy error:", error);
if (button) {
button.textContent = "Copy failed";
button.classList.add("is-copy-error");
setTimeout(() => {
if (!button.isConnected) return;
button.textContent = originalText;
button.classList.remove("is-copy-error");
button.removeAttribute("aria-label");
}, 1800);
} else {
showNotice("Unable to copy this information.", "error");
}
} finally {
window.scrollTo(originalScrollX, originalScrollY);
}
}

function getApplicationCopyText(appId) {
const app = applicationsCache.find(item => String(item.id) === String(appId));
if (!app) {
showNotice("Application not found.", "error");
return "";
}
const profile = app.customer || {};
const lines = [
"Account Name: " + String(profile.full_name || ""),
"Account Email: " + String(profile.email || ""),
"Application Reference: " + formatApplicationReference(app.reference_id ?? app.application_id ?? app.id ?? ""),
"Submitted: " + formatDate(app.created_at)
];
getApplicationFields(app).forEach(field => {
lines.push(field.label + ": " + field.value);
});
return lines.join("\n");
}

function formatApplicationReference(value) {
const reference = String(value ?? "").trim().toUpperCase();
if (!reference || reference === "UNAVAILABLE") return reference || "UNAVAILABLE";
return reference.startsWith("EIS-") ? reference : `EIS-${reference}`;
}

function getApplicationReference(app) {
return formatApplicationReference(app.reference_id ?? app.application_id ?? app.id ?? "")
.trim().toLowerCase();
}

const APPLICATIONS_PAGE_SIZE = 10;
let applicationsPage = 1;

function renderApplications() {
const searchInput = $("application-reference-search");
const statusInput = $("application-status-filter");
const query = String(searchInput?.value || "").trim().toLowerCase().replace(/^eis-/, "");
const statusFilter = String(statusInput?.value || "all").toLowerCase();
const filteredApplications = applicationsCache.filter(app => {
const matchesReference = !query || getApplicationReference(app).replace(/^eis-/, "").includes(query);
const matchesStatus = statusFilter === "all" || normalizeStatus(app.status).replace(/_/g, " ") === statusFilter;
return matchesReference && matchesStatus;
});
const pageCount = Math.max(1, Math.ceil(filteredApplications.length / APPLICATIONS_PAGE_SIZE));
applicationsPage = Math.min(Math.max(1, applicationsPage), pageCount);
const start = (applicationsPage - 1) * APPLICATIONS_PAGE_SIZE;
const visibleApplications = filteredApplications.slice(start, start + APPLICATIONS_PAGE_SIZE);

if (!applicationsCache.length) {
showEmpty("applications-full-list", "No applications have been received yet.");
if ($("applications-count")) $("applications-count").textContent = "0 Applications";
if ($("applications-badge")) $("applications-badge").style.display = "none";
if ($("applications-pagination")) $("applications-pagination").hidden = true;
return;
}

if (!filteredApplications.length) {
showEmpty("applications-full-list", "No applications match these filters.");
} else if ($("applications-full-list")) {
$("applications-full-list").innerHTML = visibleApplications.map(getApplicationHTML).join("");
}

if ($("applications-count")) {
$("applications-count").textContent = query || statusFilter !== "all"
? `Showing ${filteredApplications.length} of ${applicationsCache.length} Applications`
: `${applicationsCache.length} Applications`;
}

const pagination = $("applications-pagination");
if (pagination) {
pagination.hidden = filteredApplications.length <= APPLICATIONS_PAGE_SIZE;
if ($("applications-page-summary")) {
const first = filteredApplications.length ? start + 1 : 0;
const last = Math.min(start + APPLICATIONS_PAGE_SIZE, filteredApplications.length);
$("applications-page-summary").textContent = `Showing ${first}–${last} of ${filteredApplications.length}`;
}
if ($("applications-prev-page")) $("applications-prev-page").disabled = applicationsPage <= 1;
if ($("applications-next-page")) $("applications-next-page").disabled = applicationsPage >= pageCount;
}
}

function searchApplicationByReference() {
const input = $("application-reference-search");
const query = String(input?.value || "").trim().toLowerCase().replace(/^eis-/, "");
applicationsPage = 1;
if (!query) {
showNotice("Enter an application reference number to search.", "error");
input?.focus();
return;
}

renderApplications();
const matches = applicationsCache.filter(app =>
getApplicationReference(app).replace(/^eis-/, "").includes(query)
);
if (!matches.length) {
showNotice("No application found with that reference number.", "error");
return;
}

const exactMatch = matches.find(app => getApplicationReference(app).replace(/^eis-/, "") === query);
const target = exactMatch || matches[0];
const card = document.querySelector(`[data-application-card="${CSS.escape(String(target.id))}"]`);
const summaryButton = card?.querySelector("[data-toggle-application]");
if (summaryButton?.getAttribute("aria-expanded") !== "true") summaryButton?.click();
card?.scrollIntoView({ behavior: "smooth", block: "start" });
if (matches.length > 1 && !exactMatch) {
showNotice(`${matches.length} matching applications found. Showing the first match.`);
} else {
showNotice("Application found.");
}
}

async function updateApplicationStatus(appId, newStatus, button = null) {
const allowedStatuses = [
"In review",
"In progress",
"Completed",
"Rejected"
];

if (!allowedStatuses.includes(newStatus)) {
showNotice("Invalid application status.", "error");
return;
}

const app = applicationsCache.find(item => String(item.id) === String(appId));
if (!app) {
showNotice("Application not found.", "error");
return;
}

const statusSelect = document.querySelector(`[data-app-status="${CSS.escape(String(appId))}"]`);
const originalButtonText = button?.textContent || "Save Status";
if (button) {
button.disabled = true;
button.textContent = "Saving...";
}
if (statusSelect) statusSelect.disabled = true;

try {
const { data, error } = await supabase
.from("applications")
.update({ status: newStatus })
.eq("id", appId)
.select("id")
.maybeSingle();

if (error) throw error;
if (!data) {
throw new Error("This application could not be updated. Check your administrator access and refresh the list.");
}

showNotice("Application status updated successfully.");
await loadApplications();
} catch (error) {
console.error("Application status update error:", error);
showNotice(error.message || "Unable to update application status.", "error");
await loadApplications();
} finally {
if (button?.isConnected) {
button.disabled = false;
button.textContent = originalButtonText;
}
if (statusSelect?.isConnected) statusSelect.disabled = false;
}
}

async function loadCustomers() {
const container = $("admin-customers-list");
if (!container) return;
const requestId = ++customerLoadSequence;
setLoading("admin-customers-list", "Loading customer accounts...");

const rawQuery = String($("customer-search")?.value || "").trim();
const query = rawQuery.replace(/[^\p{L}\p{N}@.+\- ]/gu, "").trim().slice(0, 80);
const from = (customersPage - 1) * CUSTOMERS_PAGE_SIZE;

try {
let request = supabase
.from("profiles")
.select("id,full_name,email,phone,created_at", { count: "exact" })
.eq("role", "customer")
.order("created_at", { ascending: false })
.range(from, from + CUSTOMERS_PAGE_SIZE - 1);

if (query) {
const pattern = query.replace(/[%_]/g, "");
request = request.or(`full_name.ilike.%${pattern}%,email.ilike.%${pattern}%,phone.ilike.%${pattern}%`);
}

const { data, error, count } = await request;
if (error) throw error;
if (requestId !== customerLoadSequence) return;

customersTotal = Number(count || 0);
const pageCount = Math.max(1, Math.ceil(customersTotal / CUSTOMERS_PAGE_SIZE));
if (customersPage > pageCount) {
customersPage = pageCount;
return loadCustomers();
}
customersCache = data || [];

if (!customersCache.length) {
showEmpty("admin-customers-list", query ? "No customer accounts match this search." : "No customer accounts have been registered yet.");
} else {
$("admin-customers-list").innerHTML = customersCache.map(customer => {
const name = String(customer.full_name || "").trim() || "Name not provided";
const email = String(customer.email || "").trim() || "Email unavailable";
const detailId = `customer-detail-${escapeHTML(customer.id)}`;
return `
<article class="admin-customer-card">
<button type="button" class="admin-customer-summary" data-toggle-customer aria-expanded="false" aria-controls="${detailId}">
<span class="admin-customer-identity">
<strong>${escapeHTML(name)}</strong>
<span>${escapeHTML(email)}</span>
</span>
<span class="admin-customer-meta">
<time>${escapeHTML(formatShortDate(customer.created_at) || "Date unavailable")}</time>
<span class="admin-customer-expand-mark" aria-hidden="true">+</span>
</span>
</button>
<div class="admin-customer-details" id="${detailId}" hidden>
<div><span>Full name</span><strong>${escapeHTML(name)}</strong></div>
<div><span>Email address</span><strong>${escapeHTML(email)}</strong></div>
<div><span>Phone number</span><strong>${escapeHTML(customer.phone || "Not provided")}</strong></div>
<div><span>Account created</span><strong>${escapeHTML(formatDate(customer.created_at))}</strong></div>
<div class="admin-customer-actions">
<button type="button" class="admin-secondary-button" data-copy-customer-email="${escapeHTML(customer.email || "")}">Copy email</button>
${customer.phone ? `<button type="button" class="admin-secondary-button" data-copy-customer-phone="${escapeHTML(customer.phone)}">Copy phone</button>` : ""}
</div>
<div class="admin-customer-activity">
<button type="button" class="admin-secondary-button admin-customer-activity-toggle" data-view-customer-activity="${escapeHTML(customer.id)}" aria-expanded="false" aria-controls="customer-activity-${escapeHTML(customer.id)}">View account activity</button>
<div class="admin-customer-activity-content" id="customer-activity-${escapeHTML(customer.id)}" hidden><div class="admin-loading">Account activity has not been loaded.</div></div>
</div>
</div>
</article>`;
}).join("");
}

if ($("customers-count")) {
$("customers-count").textContent = query
? `Showing ${customersTotal} matching customers`
: `${customersTotal.toLocaleString()} Customers`;
}
const pagination = $("customers-pagination");
if (pagination) {
pagination.hidden = customersTotal <= CUSTOMERS_PAGE_SIZE;
const first = customersTotal ? from + 1 : 0;
const last = Math.min(from + CUSTOMERS_PAGE_SIZE, customersTotal);
if ($("customers-page-summary")) $("customers-page-summary").textContent = `Showing ${first}–${last} of ${customersTotal}`;
if ($("customers-prev-page")) $("customers-prev-page").disabled = customersPage <= 1;
if ($("customers-next-page")) $("customers-next-page").disabled = customersPage >= pageCount;
}
} catch (error) {
if (requestId !== customerLoadSequence) return;
console.error("Customers load error:", error);
showError("admin-customers-list", "Customer accounts could not be loaded. Please refresh and try again.");
if ($("customers-pagination")) $("customers-pagination").hidden = true;
}
}

async function loadCustomerActivity(customerId, panel, button) {
if (!customerId || !panel || !button) return;
button.disabled = true;
button.textContent = "Loading activity...";
panel.hidden = false;
panel.innerHTML = '<div class="admin-loading">Loading recent applications and payments...</div>';
try {
const [applicationResult, paymentResult] = await Promise.all([
supabase.from("applications").select("id,service_name,amount,status,created_at,payment_reference").eq("user_id", customerId).order("created_at", { ascending: false }).limit(10),
supabase.from("payments").select("id,reference,service_name,amount,status,created_at").eq("user_id", customerId).order("created_at", { ascending: false }).limit(10)
]);
if (applicationResult.error) throw applicationResult.error;
if (paymentResult.error) throw paymentResult.error;
const applications = applicationResult.data || [];
const payments = paymentResult.data || [];
const applicationMarkup = applications.length ? applications.map(item => `<li class="admin-customer-activity-item"><div><strong>${escapeHTML(item.service_name || "Service unavailable")}</strong><span>${escapeHTML(formatDate(item.created_at))}</span></div><div><span class="admin-customer-activity-status">${escapeHTML(item.status || "Status unavailable")}</span><strong>${escapeHTML(formatCurrency(item.amount))}</strong></div>${item.payment_reference ? `<small>Payment reference: ${escapeHTML(item.payment_reference)}</small>` : ""}</li>`).join("") : '<li class="admin-customer-activity-empty">No applications recorded.</li>';
const paymentMarkup = payments.length ? payments.map(item => `<li class="admin-customer-activity-item"><div><strong>${escapeHTML(item.service_name || "Service unavailable")}</strong><span>${escapeHTML(formatDate(item.created_at))}</span></div><div><span class="admin-customer-activity-status">${escapeHTML(getPaymentStatusLabel(item.status))}</span><strong>${escapeHTML(formatCurrency(item.amount))}</strong></div>${item.reference ? `<small>Reference: ${escapeHTML(item.reference)}</small>` : ""}</li>`).join("") : '<li class="admin-customer-activity-empty">No payments recorded.</li>';
panel.innerHTML = `<div class="admin-customer-activity-section"><h4>Recent applications <span>${applications.length}</span></h4><ul>${applicationMarkup}</ul></div><div class="admin-customer-activity-section"><h4>Recent payments <span>${payments.length}</span></h4><ul>${paymentMarkup}</ul></div><p class="admin-customer-activity-note">Showing up to 10 recent records in each category. Submitted form details are not displayed here.</p>`;
button.dataset.loaded = "true";
button.textContent = "Hide account activity";
button.setAttribute("aria-expanded", "true");
} catch (error) {
console.error("Customer activity load error:", error);
panel.innerHTML = '<div class="admin-error">Account activity could not be loaded. Please try again.</div>';
button.textContent = "Retry account activity";
button.setAttribute("aria-expanded", "true");
} finally { button.disabled = false; }
}

async function refreshCustomers() {
await loadCustomers();
showNotice("Customer directory refreshed.");
}

function getPaymentStatusLabel(status) {
const normalized = normalizeStatus(status || "pending");
const labels = {
pending: "Pending",
successful: "Paid",
used: "Used",
failed: "Failed"
};
return labels[normalized] || String(status || "Unknown").replace(/_/g, " ");
}

async function loadPayments() {
const container = $("payments-admin-list");
if (!container) return;
const requestId = ++paymentLoadSequence;
setLoading("payments-admin-list", "Loading payment records...");

const query = String($("payment-reference-search")?.value || "").trim().replace(/^eis-/i, "").replace(/[%_]/g, "");
const statusFilter = String($("payment-status-filter")?.value || "all").toLowerCase();
const requestedPage = paymentsPage;
const from = (requestedPage - 1) * PAYMENTS_PAGE_SIZE;
let request = supabase
.from("payments")
.select("id,reference,user_id,service_name,amount,status,created_at", { count: "exact" })
.order("created_at", { ascending: false })
.range(from, from + PAYMENTS_PAGE_SIZE - 1);

if (query) request = request.ilike("reference", `%EIS-${query}%`);
if (statusFilter !== "all") request = request.eq("status", statusFilter);

try {
const { data, error, count } = await request;
if (error) throw error;
if (requestId !== paymentLoadSequence) return;

paymentsTotal = Number(count || 0);
const pageCount = Math.max(1, Math.ceil(paymentsTotal / PAYMENTS_PAGE_SIZE));
if (paymentsPage > pageCount) {
paymentsPage = pageCount;
return loadPayments();
}
paymentsCache = data || [];

const userIds = [...new Set(paymentsCache.map(payment => payment.user_id).filter(Boolean))];
let profileMap = new Map();
if (userIds.length) {
const { data: profiles, error: profileError } = await supabase.rpc("admin_get_application_customers", {
p_user_ids: userIds
});
if (profileError) {
console.warn("Could not load payment customer details:", profileError);
} else {
profileMap = new Map((profiles || []).map(profile => [profile.id, profile]));
}
}

if (requestId !== paymentLoadSequence) return;
const records = paymentsCache.map(payment => {
const customer = profileMap.get(payment.user_id) || {};
const customerName = String(customer.full_name || "Customer");
const customerEmail = String(customer.email || "Email unavailable");
const status = normalizeStatus(payment.status || "pending");
const detailId = `payment-detail-${escapeHTML(payment.id)}`;
return `
<article class="admin-payment-card">
<div class="admin-payment-main">
<div class="admin-payment-reference">
<strong>${escapeHTML(payment.reference || "Reference unavailable")}</strong>
<span>${escapeHTML(formatDate(payment.created_at))}</span>
</div>
<div class="admin-payment-customer">
<strong>${escapeHTML(customerName)}</strong>
<span>${escapeHTML(customerEmail)}</span>
</div>
<div class="admin-payment-service">
<strong>${escapeHTML(payment.service_name || "Service unavailable")}</strong>
<span>Payment amount</span>
</div>
<div class="admin-payment-total">
<strong>${escapeHTML(formatCurrency(payment.amount))}</strong>
<span class="admin-status ${escapeHTML(status)}">${escapeHTML(getPaymentStatusLabel(payment.status))}</span>
</div>
</div>
<div class="admin-payment-actions">
<button type="button" class="admin-small-button" data-toggle-payment aria-expanded="false" aria-controls="${detailId}">View details</button>
</div>
<div class="admin-payment-details" id="${detailId}" hidden>
<div><span>Payment reference</span><strong>${escapeHTML(payment.reference || "Unavailable")}</strong></div>
<div><span>Customer account</span><strong>${escapeHTML(customerEmail)}</strong></div>
<div><span>Recorded date</span><strong>${escapeHTML(formatDate(payment.created_at))}</strong></div>
<div><span>Verification status</span><strong>${escapeHTML(getPaymentStatusLabel(payment.status))}</strong></div>
<button type="button" class="admin-secondary-button" data-copy-payment-ref="${escapeHTML(payment.reference || "")}">Copy reference</button>
</div>
</article>`;
});

if (!paymentsCache.length) {
showEmpty("payments-admin-list", query || statusFilter !== "all" ? "No payments match these filters." : "No payment records have been received yet.");
} else {
container.innerHTML = records.join("");
}

if ($("payments-count")) {
$("payments-count").textContent = query || statusFilter !== "all"
? `Showing ${paymentsTotal} matching payments`
: `${paymentsTotal.toLocaleString()} Payments`;
}
const pagination = $("payments-pagination");
if (pagination) {
pagination.hidden = paymentsTotal <= PAYMENTS_PAGE_SIZE;
const first = paymentsTotal ? from + 1 : 0;
const last = Math.min(from + PAYMENTS_PAGE_SIZE, paymentsTotal);
if ($("payments-page-summary")) $("payments-page-summary").textContent = `Showing ${first}–${last} of ${paymentsTotal}`;
if ($("payments-prev-page")) $("payments-prev-page").disabled = paymentsPage <= 1;
if ($("payments-next-page")) $("payments-next-page").disabled = paymentsPage >= pageCount;
}
} catch (error) {
if (requestId !== paymentLoadSequence) return;
console.error("Payments load error:", error);
showError("payments-admin-list", "Payment records could not be loaded. Please refresh and try again.");
if ($("payments-pagination")) $("payments-pagination").hidden = true;
}
}

async function refreshPayments() {
await loadPayments();
showNotice("Payment records refreshed.");
}

async function loadServices() {
setLoading("admin-services-list", "Loading services...");
setLoading("prices-services-list", "Loading services...");

setLoading(
"marketplace-services-list",
"Loading marketplace services..."
);

const { data, error } = await supabase
.from("services")
.select("id,name,price,created_at")
.order("created_at", { ascending: false });

if (error) {
console.error("Services error:", error);
showError("admin-services-list", error.message);
showError("prices-services-list", error.message);
showError("marketplace-services-list", error.message);
return;
}

servicesCache = data || [];
renderServices();
renderStatistics();
}

function getServiceHTML(service, showActions = false) {
return `
<div class="admin-service-item">
<div>
<strong>${escapeHTML(service.name)}</strong>
<span>
Added: ${escapeHTML(formatShortDate(service.created_at))}
</span>
</div>
<div class="admin-service-actions">
<strong class="admin-service-price">
${escapeHTML(formatCurrency(service.price))}
</strong>
${showActions ? `
<button
type="button"
class="admin-small-button"
data-edit-service="${escapeHTML(service.id)}">
Edit
</button>
<button
type="button"
class="admin-small-button danger"
data-delete-service="${escapeHTML(service.id)}">
Delete
</button>
` : ""}
</div>
</div>
`;
}

function renderServices() {
if (!servicesCache.length) {
showEmpty("admin-services-list", "No services found.");
showEmpty("prices-services-list", "No services found.");

showEmpty(
"marketplace-services-list",
"No marketplace services found."
);
return;
}

if ($("admin-services-list")) {
$("admin-services-list").innerHTML =
servicesCache
.slice(0, 6)
.map(service => getServiceHTML(service))
.join("");
}

if ($("prices-services-list")) {
$("prices-services-list").innerHTML =
servicesCache
.map(service => getServiceHTML(service, true))
.join("");
}

if ($("marketplace-services-list")) {
$("marketplace-services-list").innerHTML = `
<table class="admin-table">
<thead>
<tr>
<th>Service Name</th>
<th>Price</th>
<th>Date Added</th>
<th>Actions</th>
</tr>
</thead>
<tbody>
${servicesCache.map(service => `
<tr>
<td>${escapeHTML(service.name)}</td>
<td>
${escapeHTML(formatCurrency(service.price))}
</td>
<td>
${escapeHTML(formatShortDate(service.created_at))}
</td>
<td>
<button
type="button"
class="admin-small-button"
data-edit-service="${escapeHTML(service.id)}">
Edit
</button>
<button
type="button"
class="admin-small-button danger"
data-delete-service="${escapeHTML(service.id)}">
Delete
</button>
</td>
</tr>
`).join("")}
</tbody>
</table>
`;
}
}

async function addService(event) {
event.preventDefault();

const name = $("service-name")?.value.trim();
const price = Number($("service-price")?.value);

if (!name || !Number.isFinite(price) || price < 0) {
showNotice(
"Enter a valid service name and price.",
"error"
);
return;
}

const button = $("add-service-button");

if (button) {
button.disabled = true;
button.textContent = "Adding...";
}

try {
const { error } = await supabase
.from("services")
.insert({ name, price });

if (error) throw error;

$("add-service-form")?.reset();
showNotice("Service added successfully.");
await loadServices();
} catch (error) {
console.error("Add service error:", error);
showNotice(
"Unable to add service: " + error.message,
"error"
);
} finally {
if (button) {
button.disabled = false;
button.textContent = "+ Add Service";
}
}
}

async function editService(serviceId) {
const service = servicesCache.find(
item => item.id === serviceId
);

if (!service) {
showNotice("Service not found.", "error");
return;
}

const newName = window.prompt(
"Enter service name:",
service.name
);

if (newName === null) return;

const name = newName.trim();

if (!name) {
showNotice("Service name cannot be empty.", "error");
return;
}

const newPrice = window.prompt(
"Enter new service price:",
String(service.price)
);

if (newPrice === null) return;

const price = Number(newPrice);

if (!Number.isFinite(price) || price < 0) {
showNotice("Enter a valid service price.", "error");
return;
}

try {
const { error } = await supabase
.from("services")
.update({ name, price })
.eq("id", serviceId);

if (error) throw error;

showNotice("Service updated successfully.");
await loadServices();
} catch (error) {
console.error("Edit service error:", error);
showNotice(
"Unable to edit service: " + error.message,
"error"
);
}
}

async function deleteService(serviceId) {
const service = servicesCache.find(
item => item.id === serviceId
);

if (!service) {
showNotice("Service not found.", "error");
return;
}

const confirmed = window.confirm(
`Are you sure you want to delete "${service.name}"?`
);

if (!confirmed) return;

try {
const { error } = await supabase
.from("services")
.delete()
.eq("id", serviceId);

if (error) throw error;

showNotice("Service deleted successfully.");
await loadServices();
} catch (error) {
console.error("Delete service error:", error);
showNotice(
"Unable to delete service: " + error.message,
"error"
);
}
}

async function loadConversations() {
const requestId = ++conversationLoadSequence;
setLoading("admin-conversations-list", "Loading conversations...");
const { data, error } = await supabase.from("chat_conversations")
.select("id,customer_id,status,last_message,last_message_at,unread_admin_count,unread_customer_count,created_at")
.order("last_message_at", { ascending: false, nullsFirst: false });
if (requestId !== conversationLoadSequence) return;
if (error) { console.error('Conversation error:', error); showError('admin-conversations-list', 'Conversations could not be loaded. Please refresh and try again.'); return; }
const enriched = await loadConversationCustomers(data || []);
if (requestId !== conversationLoadSequence) return;
conversationsCache = enriched;
if (currentConversation) currentConversation = conversationsCache.find(item => item.id === currentConversation.id) || null;
updateConversationSummary();
renderConversations();
if (currentConversation) updateChatConversationHeader(currentConversation);
if (typeof renderStatistics === 'function') renderStatistics();
}

async function loadConversationCustomers(conversations) {
const customerIds = [...new Set(conversations.map(item => item.customer_id).filter(Boolean))];
if (!customerIds.length) return conversations;
const { data, error } = await supabase.from("profiles").select("id,full_name,email").in("id", customerIds);
if (error) { console.warn('Conversation customer details could not be loaded:', error); return conversations.map(item => ({ ...item, customer: null })); }
const profileMap = new Map((data || []).map(profile => [profile.id, profile]));
return conversations.map(item => ({ ...item, customer: profileMap.get(item.customer_id) || null }));
}

function getVisibleConversations() {
const query = String($("chat-inbox-search")?.value || "").trim().toLocaleLowerCase();
const filter = String($("chat-inbox-filter")?.value || "all").toLowerCase();
return conversationsCache.filter(conversation => {
const unread = Number(conversation.unread_admin_count || 0) > 0;
const status = String(conversation.status || "Open").trim().toLowerCase();
if (filter === "unread" && !unread) return false;
if (filter === "open" && status !== "open") return false;
if (filter === "closed" && status !== "closed") return false;
if (!query) return true;
const searchable = [getCustomerName(conversation.customer), conversation.customer?.email, conversation.last_message].join(' ').toLocaleLowerCase();
return searchable.includes(query);
});
}

function updateConversationSummary() {
const total = conversationsCache.length;
const unread = conversationsCache.reduce((sum, item) => sum + Math.max(0, Number(item.unread_admin_count || 0)), 0);
if ($("chat-conversation-count")) $("chat-conversation-count").textContent = `${total} ${total === 1 ? "conversation" : "conversations"}`;
if ($("chat-unread-count")) $("chat-unread-count").textContent = `${unread} unread`;
}

function renderConversations() {
const container = $("admin-conversations-list");
if (!container) return;
const visible = getVisibleConversations();
if (!visible.length) {
const hasConversations = conversationsCache.length > 0;
showEmpty("admin-conversations-list", hasConversations ? "No conversations match these filters." : "No customer conversations yet.");
return;
}
container.innerHTML = visible.map(conversation => {
const name = getCustomerName(conversation.customer);
const unread = Number(conversation.unread_admin_count || 0);
const active = currentConversation?.id === conversation.id;
const status = String(conversation.status || "Open");
const lastMessage = conversation.last_message || 'No messages yet';
return `
<button type="button" class="admin-conversation-item ${active ? "active" : ""} ${unread > 0 ? "has-unread" : ""}" data-conversation-id="${escapeHTML(conversation.id)}" aria-current="${active ? "true" : "false"}">
<span class="conversation-avatar" aria-hidden="true">${escapeHTML(getInitials(name))}</span>
<span class="conversation-info">
<span class="conversation-item-topline"><strong>${escapeHTML(name)}</strong><time>${escapeHTML(formatShortDate(conversation.last_message_at || conversation.created_at))}</time></span>
<span class="conversation-email">${escapeHTML(conversation.customer?.email || "Email not available")}</span>
<span class="conversation-preview">${escapeHTML(lastMessage)}</span>
<span class="conversation-item-bottomline"><span class="conversation-status-label ${status.toLowerCase() === "closed" ? "closed" : "open"}">${escapeHTML(status)}</span>${unread > 0 ? `<span class="conversation-unread">${unread > 99 ? "99+" : unread}</span>` : ""}</span>
</span>
</button>`;
}).join('');
}

async function openConversation(conversationId) {
const conversation = conversationsCache.find(item => item.id === conversationId);
if (!conversation) { showNotice("Conversation not found.", "error"); return; }
currentConversation = conversation;
chatMessageLoadSequence += 1;
renderConversations();
if ($("admin-chat-empty")) $("admin-chat-empty").hidden = true;
if ($("admin-chat-active")) $("admin-chat-active").hidden = false;
updateChatConversationHeader(conversation);
await loadChatMessages(conversationId);
if (currentConversation?.id === conversationId) await markConversationRead(conversationId);
}

function updateChatConversationHeader(conversation) {
if (!conversation) return;
const name = getCustomerName(conversation.customer);
if ($("chat-customer-name")) $("chat-customer-name").textContent = name;
if ($("chat-customer-email")) $("chat-customer-email").textContent = conversation.customer?.email || "Email not available";
if ($("chat-customer-avatar")) $("chat-customer-avatar").textContent = getInitials(name);
const closed = String(conversation.status || "Open").toLowerCase() === "closed";
if ($("chat-customer-status")) $("chat-customer-status").textContent = closed ? "Closed conversation" : "Open conversation";

}

async function loadChatMessages(conversationId) {
const requestId = ++chatMessageLoadSequence;
setLoading("admin-chat-messages", "Loading messages...");
const { data, error } = await supabase.from("chat_messages")
.select("id,conversation_id,sender_id,sender_role,content,attachment_url,is_read,created_at")
.eq("conversation_id", conversationId)
.order("created_at", { ascending: true });
if (requestId !== chatMessageLoadSequence || currentConversation?.id !== conversationId) return;
if (error) { console.error("Chat messages error:", error); showError("admin-chat-messages", "Messages could not be loaded. Please try again."); return; }
renderChatMessages(data || []);
}

function getSafeChatAttachmentUrl(value) {
try {
const url = new URL(String(value || ''), window.location.origin);
return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
} catch (error) { return ''; }
}
function renderChatMessages(messages) {
const container = $("admin-chat-messages");
if (!container) return;

if (!messages.length) {
showEmpty(
"admin-chat-messages",
"No messages in this conversation yet."
);
return;
}

container.innerHTML = messages.map(message => {
const senderRole = String(message.sender_role || "")
.toLowerCase();

const isAdmin = senderRole === "admin";

return `
<div class="chat-message ${isAdmin ? "admin" : "customer"}">
<div>
${escapeHTML(message.content)}
</div>
${getSafeChatAttachmentUrl(message.attachment_url) ? `
<p class="chat-attachment-link">Attachment: <a href="${escapeHTML(getSafeChatAttachmentUrl(message.attachment_url))}" target="_blank" rel="noopener noreferrer">View attachment</a></p>
` : message.attachment_url ? '<p class="chat-attachment-unavailable">Attachment link unavailable.</p>' : ""}
<time>
${escapeHTML(formatDate(message.created_at))}
</time>
</div>
`;
}).join("");

container.scrollTop = container.scrollHeight;
}

/* FIX: Mark opened customer messages as read and reset the sidebar badge. */
async function markConversationRead(conversationId) {
try {
const { error: messagesError } = await supabase.from("chat_messages")
.update({ is_read: true })
.eq("conversation_id", conversationId)
.eq("sender_role", "customer")
.eq("is_read", false);
if (messagesError) throw messagesError;
// The database trigger maintains unread_admin_count for each message marked read.
const { data: conversationData, error: conversationError } = await supabase.from("chat_conversations")
.select("unread_admin_count")
.eq("id", conversationId)
.single();
if (conversationError) throw conversationError;
conversationsCache = conversationsCache.map(item => item.id === conversationId ? { ...item, unread_admin_count: Number(conversationData.unread_admin_count || 0) } : item);
if (currentConversation?.id === conversationId) currentConversation = conversationsCache.find(item => item.id === conversationId) || currentConversation;
updateConversationSummary();
renderConversations();
if (typeof renderStatistics === 'function') renderStatistics();
} catch (error) {
console.error("Mark conversation read error:", error);
showNotice("Messages opened, but their read status could not be updated.", "error");
}
}

async function sendChatMessage(event) {
event.preventDefault();
if (isSendingMessage) return;
const conversationId = currentConversation?.id;
if (!conversationId || !currentUser) { showNotice("Select a conversation first.", "error"); return; }
const input = $("admin-chat-input");
const content = input?.value.trim();
if (!content) return;
isSendingMessage = true;
const button = $("admin-chat-send");
if (button) { button.disabled = true; button.textContent = "Sending..."; }
try {
const { error } = await supabase.from("chat_messages").insert({ conversation_id: conversationId, sender_id: currentUser.id, sender_role: "admin", content, is_read: false });
if (error) throw error;
if (currentConversation?.id === conversationId && input?.value.trim() === content) input.value = '';
if (currentConversation?.id === conversationId) await loadChatMessages(conversationId);
await loadConversations();
if (currentConversation?.id === conversationId) updateChatConversationHeader(currentConversation);
showNotice("Reply sent successfully.");
} catch (error) {
console.error("Send message error:", error);
showNotice("Unable to send message. Please try again.", "error");
} finally {
isSendingMessage = false;
if (button) { button.textContent = "Send"; button.disabled = false; }
}
}

async function sendBroadcast(event) {
event.preventDefault();

const title = $("broadcast-title")?.value.trim();
const message = $("broadcast-message")?.value.trim();

if (!title || !message) {
showNotice(
"Enter both notification title and message.",
"error"
);
return;
}

const button = $("broadcast-send");

if (button) {
button.disabled = true;
button.textContent = "Sending...";
}

try {
const { data: profiles, error: profileError } = await supabase
.from("profiles")
.select("id");

if (profileError) throw profileError;

const recipients = (profiles || []).filter(
profile => profile.id
);

if (!recipients.length) {
throw new Error("No registered profiles found.");
}

const notificationRows = recipients.map(profile => ({
user_id: profile.id,
title,
message,
is_read: false
}));

const batchSize = 200;

for (
let index = 0;
index < notificationRows.length;
index += batchSize
) {
const batch = notificationRows.slice(
index,
index + batchSize
);

const { error } = await supabase
.from("notifications")
.insert(batch);

if (error) throw error;
}

$("broadcast-form")?.reset();

showNotice(
`Broadcast sent successfully to ${recipients.length} accounts.`
);

} catch (error) {
console.error("Broadcast error:", error);
showNotice(
"Broadcast failed: " + error.message,
"error"
);
} finally {
if (button) {
button.disabled = false;
button.textContent = "Send Broadcast";
}
}
}

function openSection(sectionName) {
if (sectionName === "site-settings" && String(currentProfile?.role || "").toLowerCase() !== "super_admin") {
  showNotice("Only the Super Admin can access Site Settings.", "error");
  return;
}
const sections = document.querySelectorAll(
".admin-section"
);

sections.forEach(section => {
section.classList.remove("active");
});

const target = $("section-" + sectionName);
if (!target) return;

try {
sessionStorage.setItem("eis_admin_current_section", sectionName);
} catch (error) {
console.warn("Could not save current admin section:", error);
}

target.classList.add("active");

if (sectionName === "applications") markApplicationsAsSeen();
if (sectionName === "payments") loadPayments();
if (sectionName === "customers") loadCustomers();

document.querySelectorAll(".sidebar-link").forEach(link => {
link.classList.toggle(
"active",
link.dataset.section === sectionName
);
});

const titleMap = {
overview: "Overview",
marketplace: "Marketplace",
applications: "Applications",
payments: "Payments",
customers: "Customers",
"customer-care": "Customer Care",
prices: "Prices Management",
broadcast: "Broadcast Message",
"site-settings": "Site Settings"
};

if ($("breadcrumb-current")) {
$("breadcrumb-current").textContent =
titleMap[sectionName] || sectionName;
}

closeSidebar();

window.scrollTo({
top: 0,
behavior: "smooth"
});
}

function setupNavigation() {
document.querySelectorAll(".sidebar-link").forEach(button => {
button.addEventListener("click", () => {
openSection(button.dataset.section);
});
});

document.querySelectorAll("[data-open-section]").forEach(button => {
button.addEventListener("click", () => {
openSection(button.dataset.openSection);
});
});
}

function setupSidebar() {
$("menu-toggle")?.addEventListener("click", openSidebar);
$("close-sidebar")?.addEventListener("click", closeSidebar);
$("admin-overlay")?.addEventListener("click", closeSidebar);

document.addEventListener("keydown", event => {
if (event.key === "Escape") {
closeSidebar();
}
});
}

function openSidebar() {
$("admin-sidebar")?.classList.add("open");
$("admin-overlay")?.classList.add("active");
document.body.style.overflow = "hidden";
}

function closeSidebar() {
$("admin-sidebar")?.classList.remove("open");
$("admin-overlay")?.classList.remove("active");
document.body.style.overflow = "";
}

async function logoutAdmin() {
const confirmed = window.confirm(
"Are you sure you want to log out?"
);

if (!confirmed) return;

try {
await removeRealtimeSubscriptions();

const { error } = await supabase.auth.signOut();

if (error) throw error;

window.location.replace("index.html");

} catch (error) {
console.error("Logout error:", error);
showNotice(
"Unable to log out: " + error.message,
"error"
);
}
}

async function refreshApplications() {
await loadApplications();
showNotice("Applications refreshed.");
}

async function refreshServices() {
await loadServices();
showNotice("Services refreshed.");
}

async function refreshConversations() {
await loadConversations();

if (currentConversation) {
const stillExists = conversationsCache.some(
item => item.id === currentConversation.id
);

if (stillExists) {
await loadChatMessages(currentConversation.id);
}
}

showNotice("Customer conversations refreshed.");
}

async function refreshDashboard() {
const button = $("overview-refresh");

if (button) {
button.disabled = true;
button.textContent = "Refreshing...";
}

try {
await loadAllDashboardData();
showNotice("Dashboard refreshed successfully.");
} finally {
if (button) {
button.disabled = false;
button.textContent = "↻ Refresh Data";
}
}
}

async function setManagedAdminRole(email, makeAdmin, button) {
  if (String(currentProfile?.role || "").toLowerCase() !== "super_admin") {
    showNotice("Only the Super Admin can manage administrator accounts.", "error");
    return;
  }
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    showNotice("Enter a valid email address.", "error");
    return;
  }
  const action = makeAdmin ? "grant Admin access to " + normalizedEmail : "remove Admin access from " + normalizedEmail;
  if (!window.confirm("Are you sure you want to " + action + "?")) return;
  if (button) { button.disabled = true; button.textContent = "Processing..."; }
  try {
    const { error } = await supabase.rpc("super_admin_set_admin_by_email", {
      p_email: normalizedEmail,
      p_make_admin: makeAdmin
    });
    if (error) throw error;
    showNotice(makeAdmin ? "Admin access successfully granted to " + normalizedEmail : "Admin access removed from " + normalizedEmail);
    $("admin-manage-email")?.value && ($("admin-manage-email").value = "");
    $("admin-manage-action") && ($("admin-manage-action").value = "make_admin");
  } catch (error) {
    console.error("Super Admin role update error:", error);
    showNotice(error.message || "Unable to update administrator access.", "error");
  } finally {
    if (button) { button.disabled = false; button.textContent = "Submit"; }
  }
}

function setupEventListeners() {
$("admin-manage-form")?.addEventListener("submit", event => {
  event.preventDefault();
  const email = $("admin-manage-email")?.value || "";
  const makeAdmin = $("admin-manage-action")?.value === "make_admin";
  setManagedAdminRole(email, makeAdmin, $("admin-manage-submit"));
});

$("nav-logout")?.addEventListener(
"click",
logoutAdmin
);

$("admin-top-logout")?.addEventListener(
"click",
logoutAdmin
);

$("sidebar-logout")?.addEventListener(
"click",
logoutAdmin
);

$("topbar-chat")?.addEventListener("click", () => {
openSection("customer-care");
});

$("overview-refresh")?.addEventListener(
"click",
refreshDashboard
);

$("refresh-applications")?.addEventListener(
"click",
refreshApplications
);
$("refresh-payments")?.addEventListener("click", refreshPayments);
$("refresh-customers")?.addEventListener("click", refreshCustomers);
$("search-customers")?.addEventListener("click", () => { customersPage = 1; loadCustomers(); });
$("customer-search")?.addEventListener("keydown", event => {
if (event.key === "Enter") { event.preventDefault(); customersPage = 1; loadCustomers(); }
});
$("customers-prev-page")?.addEventListener("click", () => { customersPage = Math.max(1, customersPage - 1); loadCustomers(); });
$("customers-next-page")?.addEventListener("click", () => { customersPage += 1; loadCustomers(); });

$("search-payment-reference")?.addEventListener("click", () => { paymentsPage = 1; loadPayments(); });
$("payment-reference-search")?.addEventListener("keydown", event => {
if (event.key === "Enter") { event.preventDefault(); paymentsPage = 1; loadPayments(); }
});
$("payment-status-filter")?.addEventListener("change", () => { paymentsPage = 1; loadPayments(); });
$("payments-prev-page")?.addEventListener("click", () => { paymentsPage = Math.max(1, paymentsPage - 1); loadPayments(); });
$("payments-next-page")?.addEventListener("click", () => { paymentsPage += 1; loadPayments(); });

$("application-reference-search")?.addEventListener("input", () => { applicationsPage = 1; renderApplications(); });
$("application-status-filter")?.addEventListener("change", () => { applicationsPage = 1; renderApplications(); });
$("applications-prev-page")?.addEventListener("click", () => { applicationsPage = Math.max(1, applicationsPage - 1); renderApplications(); });
$("applications-next-page")?.addEventListener("click", () => { applicationsPage += 1; renderApplications(); });
$("application-reference-search")?.addEventListener("keydown", event => {
if (event.key === "Enter") {
event.preventDefault();
searchApplicationByReference();
}
});
$("search-application-reference")?.addEventListener("click", searchApplicationByReference);

$("refresh-services")?.addEventListener(
"click",
refreshServices
);

// Marketplace product refresh is handled by js/marketplace-admin.js.

$("refresh-conversations")?.addEventListener(
"click",
refreshConversations
);
$("chat-inbox-search")?.addEventListener("input", renderConversations);
$("chat-inbox-filter")?.addEventListener("change", renderConversations);
$("add-service-form")?.addEventListener(
"submit",
addService
);

$("broadcast-form")?.addEventListener(
"submit",
sendBroadcast
);

$("admin-chat-form")?.addEventListener(
"submit",
sendChatMessage
);

// Application status is saved only when the Save Status button is pressed.

document.addEventListener("click", event => {
const customerToggle = event.target.closest("[data-toggle-customer]");
if (customerToggle) {
const expanded = customerToggle.getAttribute("aria-expanded") === "true";
customerToggle.setAttribute("aria-expanded", String(!expanded));
const details = document.getElementById(customerToggle.getAttribute("aria-controls"));
if (details) details.hidden = expanded;
return;
}
const customerActivityButton = event.target.closest("[data-view-customer-activity]");
if (customerActivityButton) {
event.preventDefault();
const panel = document.getElementById(customerActivityButton.getAttribute("aria-controls"));
if (customerActivityButton.dataset.loaded === "true") {
const expanded = customerActivityButton.getAttribute("aria-expanded") === "true";
if (panel) panel.hidden = expanded;
customerActivityButton.setAttribute("aria-expanded", String(!expanded));
customerActivityButton.textContent = expanded ? "View account activity" : "Hide account activity";
} else if (!customerActivityButton.disabled) {
loadCustomerActivity(customerActivityButton.dataset.viewCustomerActivity, panel, customerActivityButton);
}
return;
}
const customerCopyEmail = event.target.closest("[data-copy-customer-email]");
if (customerCopyEmail) {
event.preventDefault();
copyTextToClipboard(customerCopyEmail.dataset.copyCustomerEmail || "", customerCopyEmail);
return;
}
const customerCopyPhone = event.target.closest("[data-copy-customer-phone]");
if (customerCopyPhone) {
event.preventDefault();
copyTextToClipboard(customerCopyPhone.dataset.copyCustomerPhone || "", customerCopyPhone);
return;
}
const paymentToggle = event.target.closest("[data-toggle-payment]");
if (paymentToggle) {
const expanded = paymentToggle.getAttribute("aria-expanded") === "true";
paymentToggle.setAttribute("aria-expanded", String(!expanded));
const details = document.getElementById(paymentToggle.getAttribute("aria-controls"));
if (details) details.hidden = expanded;
paymentToggle.textContent = expanded ? "View details" : "Hide details";
return;
}
const paymentCopyButton = event.target.closest("[data-copy-payment-ref]");
if (paymentCopyButton) {
event.preventDefault();
copyTextToClipboard(paymentCopyButton.dataset.copyPaymentRef || "", paymentCopyButton);
return;
}
const applicationToggle = event.target.closest("[data-toggle-application]");
if (applicationToggle) {
const expanded = applicationToggle.getAttribute("aria-expanded") === "true";
applicationToggle.setAttribute("aria-expanded", String(!expanded));
const details = document.getElementById(applicationToggle.getAttribute("aria-controls"));
if (details) details.hidden = expanded;
return;
}
const copyFieldButton = event.target.closest("[data-copy-value]");
if (copyFieldButton) {
event.preventDefault();
copyTextToClipboard(
copyFieldButton.dataset.copyValue || "",
copyFieldButton
);
return;
}
const copyAllButton = event.target.closest("[data-copy-application]");
if (copyAllButton) {
event.preventDefault();
copyTextToClipboard(
getApplicationCopyText(copyAllButton.dataset.copyApplication),
copyAllButton
);
return;
}
const saveStatusButton = event.target.closest("[data-save-app-status]");
if (saveStatusButton) {
const appId = saveStatusButton.dataset.saveAppStatus;
const select = [...document.querySelectorAll("[data-app-status]")].find(item => item.dataset.appStatus === appId);
if (select) updateApplicationStatus(appId, select.value, saveStatusButton);
return;
}
const editButton = event.target.closest(
"[data-edit-service]"
);

if (editButton) {
editService(editButton.dataset.editService);
return;
}

const deleteButton = event.target.closest(
"[data-delete-service]"
);

if (deleteButton) {
deleteService(deleteButton.dataset.deleteService);
return;
}

const conversationButton = event.target.closest(
"[data-conversation-id]"
);

if (conversationButton) {
openConversation(
conversationButton.dataset.conversationId
);
}
});
}

function setupRealtime() {
const applicationsChannel = supabase
.channel("admin-applications-live")
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
.subscribe();

realtimeChannels.push(applicationsChannel);

const paymentsChannel = supabase
.channel("admin-payments-live")
.on(
"postgres_changes",
{
event: "*",
schema: "public",
table: "payments"
},
() => {
if ($("section-payments")?.classList.contains("active")) loadPayments();
}
)
.subscribe();

realtimeChannels.push(paymentsChannel);

const servicesChannel = supabase
.channel("admin-services-live")
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
.subscribe();

realtimeChannels.push(servicesChannel);

const conversationsChannel = supabase
.channel("admin-conversations-live")
.on(
"postgres_changes",
{
event: "*",
schema: "public",
table: "chat_conversations"
},
() => {
loadConversations();
}
)
.subscribe();

realtimeChannels.push(conversationsChannel);

const messagesChannel = supabase
.channel("admin-messages-live")
.on(
"postgres_changes",
{
event: "INSERT",
schema: "public",
table: "chat_messages"
},
payload => {
if (
currentConversation &&
payload.new?.conversation_id === currentConversation.id
) {
loadChatMessages(currentConversation.id);
}

loadConversations();
}
)
.subscribe();

realtimeChannels.push(messagesChannel);
}

async function removeRealtimeSubscriptions() {
for (const channel of realtimeChannels) {
try {
await supabase.removeChannel(channel);
} catch (error) {
console.warn(
"Realtime cleanup error:",
error
);
}
}

realtimeChannels = [];
}

supabase.auth.onAuthStateChange((event, session) => {
if (event === "SIGNED_OUT") {
currentUser = null;
currentProfile = null;
removeRealtimeSubscriptions();
}
});

window.EISAdmin = {
refreshDashboard,
refreshApplications,
refreshPayments,
refreshServices,
refreshConversations,
openSection,
logout: logoutAdmin,

getCurrentUser() {
return currentUser;
},

getCurrentProfile() {
return currentProfile;
},

getApplications() {
return [...applicationsCache];
},

getServices() {
return [...servicesCache];
},

getConversations() {
return [...conversationsCache];
}
};

initializeAdmin();
