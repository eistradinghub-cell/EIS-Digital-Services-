import { supabase } from "./supabase.js";
const $ = (id) => document.getElementById(id);
let currentUser = null;
let currentProfile = null;
let applicationsCache = [];
let servicesCache = [];
let conversationsCache = [];
let currentConversation = null;
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
updateAdminIdentity();
updateDate();
setupNavigation();
setupSidebar();
setupEventListeners();
await loadAllDashboardData();
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
if ($("stat-products")) {
$("stat-products").textContent =
servicesCache.length.toLocaleString();
}
if ($("applications-badge")) {
$("applications-badge").textContent = total;
}
const unread = conversationsCache.reduce((sum, conversation) => {
return sum + Number(conversation.unread_admin_count || 0);
}, 0);
if ($("chat-badge")) {
$("chat-badge").textContent = unread;
}
}
async function loadApplications() {
setLoading("admin-apps-list", "Loading applications...");
setLoading("applications-full-list", "Loading applications...");
const { data, error } = await supabase
.from("applications")
.select("*")
.order("created_at", { ascending: false });
if (error) {
console.error("Applications error:", error);
showError("admin-apps-list", error.message);
showError("applications-full-list", error.message);
return;
}
applicationsCache = data || [];
await loadApplicationCustomers();
renderApplications();
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
.from("profiles")
.select("id,full_name,email,phone")
.in("id", userIds);
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
function getApplicationHTML(app) {
const status = normalizeStatus(app.status);
const customer = getCustomerName(app.customer);
const service = app.service_name || "Service";
const phone =
getFormValue(app.form_data, "phone") ||
app.customer?.phone ||
"Not provided";
const options = [
["In review", "In Review"],
["In progress", "In Progress"],
["Completed", "Completed"],
["Rejected", "Rejected"]
];
return `
<article class="admin-app-item">
<div class="admin-app-details">
<strong>${escapeHTML(service)}</strong>
<span>
Customer: ${escapeHTML(customer)}
</span>
<span>
Phone: ${escapeHTML(phone)}
</span>
<span>
Amount: ${escapeHTML(formatCurrency(app.amount))}
</span>
<span>
Submitted: ${escapeHTML(formatDate(app.created_at))}
</span>
${app.reason ? `
<span>
Reason: ${escapeHTML(app.reason)}
</span>
` : ""}
<span class="admin-status ${escapeHTML(status)}">
${escapeHTML(
String(app.status || "In review")
)}
</span>
</div>
<div class="admin-app-actions">
<select
class="admin-status-select"
data-app-status="${escapeHTML(app.id)}"
aria-label="Change application status">
${options.map(([value, label]) => `
<option
value="${escapeHTML(value)}"
${String(app.status || "In review") === value ? "selected" : ""}>
${label}
</option>
`).join("")}
</select>
</div>
</article>
`;
}
function renderApplications() {
const recent = applicationsCache.slice(0, 5);
if (!applicationsCache.length) {
showEmpty(
"admin-apps-list",
"No applications have been submitted yet."
);
showEmpty(
"applications-full-list",
"No applications found."
);
if ($("applications-count")) {
$("applications-count").textContent = "0 Applications";
}
return;
}
if ($("admin-apps-list")) {
$("admin-apps-list").innerHTML =
recent.map(getApplicationHTML).join("");
}
if ($("applications-full-list")) {
$("applications-full-list").innerHTML =
applicationsCache.map(getApplicationHTML).join("");
}
if ($("applications-count")) {
$("applications-count").textContent =
`${applicationsCache.length} Applications`;
}
}
async function updateApplicationStatus(appId, newStatus) {
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
const app = applicationsCache.find(item => item.id === appId);
if (!app) {
showNotice("Application not found.", "error");
return;
}
const { error } = await supabase
.from("applications")
.update({ status: newStatus })
.eq("id", appId);
if (error) {
console.error("Application update error:", error);
showNotice(
"Could not update application: " + error.message,
"error"
);
await loadApplications();
return;
}
showNotice("Application status updated successfully.");
await loadApplications();
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
"Unable to update service: " + error.message,
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
setLoading(
"admin-conversations-list",
"Loading conversations..."
);
const { data, error } = await supabase
.from("chat_conversations")
.select("*")
.order("last_message_at", {
ascending: false,
nullsFirst: false
});
if (error) {
console.error("Conversation error:", error);
showError("admin-conversations-list", error.message);
return;
}
conversationsCache = data || [];
await loadConversationCustomers();
renderConversations();
renderStatistics();
}
async function loadConversationCustomers() {
const customerIds = [
...new Set(
conversationsCache
.map(item => item.customer_id)
.filter(Boolean)
)
];
if (!customerIds.length) return;
const { data, error } = await supabase
.from("profiles")
.select("id,full_name,email,phone")
.in("id", customerIds);
if (error) {
console.warn("Conversation customer error:", error);
return;
}
const profileMap = new Map(
(data || []).map(profile => [profile.id, profile])
);
conversationsCache = conversationsCache.map(item => ({
...item,
customer: profileMap.get(item.customer_id) || null
}));
}
function renderConversations() {
const container = $("admin-conversations-list");
if (!container) return;
if (!conversationsCache.length) {
showEmpty(
"admin-conversations-list",
"No customer conversations found."
);
return;
}
container.innerHTML = conversationsCache.map(conversation => {
const name = getCustomerName(conversation.customer);
const unread = Number(
conversation.unread_admin_count || 0
);
const active =
currentConversation?.id === conversation.id;
return `
<button
type="button"
class="admin-conversation-item ${active ? "active" : ""}"
data-conversation-id="${escapeHTML(conversation.id)}">
<div class="conversation-avatar" aria-label="EIS Digital Services logo">
<svg viewBox="0 0 48 48" role="img" aria-label="EIS Digital Services">
<rect x="2" y="2" width="44" height="44" rx="12" fill="#1f4fe0"/>
<path d="M14 32 L24 14 L34 32" stroke="#fff" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<circle cx="24" cy="26" r="2.6" fill="#12b894"/>
</svg>
</div>
<div class="conversation-info">
<strong>${escapeHTML(name)}</strong>
<span class="conversation-email">
${escapeHTML(
conversation.customer?.email || "Email not available"
)}
</span>
<p>
${escapeHTML(
conversation.last_message || "No messages yet"
)}
</p>
<span>
${escapeHTML(
formatShortDate(
conversation.last_message_at ||
conversation.created_at
)
)}
</span>
</div>
${unread > 0 ? `
<span class="conversation-unread">
${unread}
</span>
` : ""}
</button>
`;
}).join("");
}
async function openConversation(conversationId) {
const conversation = conversationsCache.find(
item => item.id === conversationId
);
if (!conversation) {
showNotice("Conversation not found.", "error");
return;
}
currentConversation = conversation;
renderConversations();
if ($("admin-chat-empty")) {
$("admin-chat-empty").hidden = true;
}
if ($("admin-chat-active")) {
$("admin-chat-active").hidden = false;
}
const name = getCustomerName(conversation.customer);
if ($("chat-customer-name")) {
$("chat-customer-name").textContent = name;
}
if ($("chat-customer-email")) {
$("chat-customer-email").textContent =
conversation.customer?.email || "Email not available";
}
if ($("chat-customer-avatar")) {
$("chat-customer-avatar").innerHTML = `
<svg viewBox="0 0 48 48" role="img" aria-label="EIS Digital Services">
<rect x="2" y="2" width="44" height="44" rx="12" fill="#1f4fe0"/>
<path d="M14 32 L24 14 L34 32" stroke="#fff" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<circle cx="24" cy="26" r="2.6" fill="#12b894"/>
</svg>
`;
}
if ($("chat-customer-status")) {
$("chat-customer-status").textContent =
conversation.status || "Conversation";
}
await loadChatMessages(conversationId);
await markConversationRead(conversationId);
}
async function loadChatMessages(conversationId) {
setLoading("admin-chat-messages", "Loading messages...");
const { data, error } = await supabase
.from("chat_messages")
.select(`
id,
conversation_id,
sender_id,
sender_role,
content,
attachment_url,
is_read,
created_at
`)
.eq("conversation_id", conversationId)
.order("created_at", { ascending: true });
if (error) {
console.error("Chat messages error:", error);
showError("admin-chat-messages", error.message);
return;
}
renderChatMessages(data || []);
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
${message.attachment_url ? `
<p>
Attachment:
<a
href="${escapeHTML(message.attachment_url)}"
target="_blank"
rel="noopener noreferrer">
View attachment
</a>
</p>
` : ""}
<time>
${escapeHTML(formatDate(message.created_at))}
</time>
</div>
`;
}).join("");
container.scrollTop = container.scrollHeight;
}
async function markConversationRead(conversationId) {
try {
const { error } = await supabase
.from("chat_messages")
.update({ is_read: true })
.eq("conversation_id", conversationId)
.eq("sender_role", "customer")
.eq("is_read", false);
if (error) {
console.warn(
"Could not mark customer messages as read:",
error
);
return;
}
await loadConversations();
currentConversation = conversationsCache.find(
item => item.id === conversationId
) || currentConversation;
} catch (error) {
console.error("Mark conversation read error:", error);
}
}
async function sendChatMessage(event) {
event.preventDefault();
if (isSendingMessage) return;
if (!currentConversation || !currentUser) {
showNotice("Select a conversation first.", "error");
return;
}
const input = $("admin-chat-input");
const content = input?.value.trim();
if (!content) return;
isSendingMessage = true;
const button = $("admin-chat-send");
if (button) {
button.disabled = true;
button.textContent = "Sending...";
}
try {
const { error } = await supabase
.from("chat_messages")
.insert({
conversation_id: currentConversation.id,
sender_id: currentUser.id,
sender_role: "admin",
content,
is_read: false
});
if (error) throw error;
input.value = "";
await loadChatMessages(currentConversation.id);
await loadConversations();
currentConversation = conversationsCache.find(
item => item.id === currentConversation?.id
) || currentConversation;
showNotice("Message sent successfully.");
} catch (error) {
console.error("Send message error:", error);
showNotice(
"Unable to send message: " + error.message,
"error"
);
} finally {
isSendingMessage = false;
if (button) {
button.disabled = false;
button.textContent = "Send";
}
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
const sections = document.querySelectorAll(
".admin-section"
);
sections.forEach(section => {
section.classList.remove("active");
});
const target = $("section-" + sectionName);
if (!target) return;
target.classList.add("active");
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
function setupEventListeners() {
$("nav-logout")?.addEventListener(
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
$("refresh-services")?.addEventListener(
"click",
refreshServices
);
// Marketplace product refresh is handled by js/marketplace-admin.js.

$("refresh-conversations")?.addEventListener(
"click",
refreshConversations
);
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
document.addEventListener("change", event => {
const select = event.target.closest(
"[data-app-status]"
);
if (!select) return;
updateApplicationStatus(
select.dataset.appStatus,
select.value
);
});
document.addEventListener("click", event => {
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
