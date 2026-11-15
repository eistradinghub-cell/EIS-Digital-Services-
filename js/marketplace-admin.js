import { supabase } from "./supabase.js";

const $ = (id) => document.getElementById(id);

let adminUser = null;
let products = [];
let selectedImage = null;
let editingProduct = null;

function escapeHTML(value) {
return String(value ?? "").replace(/[&<>"']/g, char => ({
"&": "&",
"<": "<",
">": ">",
'"': """,
"'": "'"
})[char]);
}

function formatPrice(value) {
return "₦" + Number(value || 0).toLocaleString("en-NG", {
minimumFractionDigits: 0,
maximumFractionDigits: 2
});
}

function showMessage(message, type = "success") {
const box = $("marketplace-form-message");
if (!box) return;

box.textContent = message;
box.className = "admin-notice " + type;
box.hidden = false;

}

function setButtonLoading(loading, label = "Post Product") {
const button = $("product-submit");
if (!button) return;

button.disabled = loading;
button.textContent = loading ? "Please wait..." : label;

}

async function verifyAdmin() {
const { data: { session }, error } = await supabase.auth.getSession();

if (error) throw error;

if (!session?.user) {
    throw new Error("Your admin session has expired. Please sign in again.");
}

const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,role")
    .eq("id", session.user.id)
    .single();

if (profileError) throw profileError;

if (!profile || !["admin", "super_admin"].includes(
    String(profile.role || "").toLowerCase()
)) {
    throw new Error("Administrator permission is required.");
}

adminUser = session.user;

}

function resetForm() {
$("marketplace-product-form")?.reset();

if ($("marketplace-product-id")) {
    $("marketplace-product-id").value = "";
}

if ($("marketplace-form-heading")) {
    $("marketplace-form-heading").textContent = "Post a New Product";
}

if ($("product-submit")) {
    $("product-submit").textContent = "Post Product";
}

if ($("marketplace-cancel-edit")) {
    $("marketplace-cancel-edit").hidden = true;
}

if ($("marketplace-image-preview")) {
    $("marketplace-image-preview").innerHTML = "";
}

selectedImage = null;
editingProduct = null;

}

function previewImage(file) {
const preview = $("marketplace-image-preview");
if (!preview) return;

if (!file) {
    preview.innerHTML = "";
    selectedImage = null;
    return;
}

if (!file.type.startsWith("image/")) {
    showMessage("Please select a valid image file.", "error");
    return;
}

if (file.size > 5 * 1024 * 1024) {
    showMessage("Image size must not exceed 5MB.", "error");
    return;
}

selectedImage = file;

const reader = new FileReader();

reader.onload = () => {
    preview.innerHTML = `
        <img
            src="${reader.result}"
            alt="Product preview"
            style="width:100%;max-width:220px;height:160px;object-fit:cover;border-radius:12px;"
        >
    `;
};

reader.readAsDataURL(file);

}

async function uploadProductImage(file) {
const extension = file.name.split(".").pop().toLowerCase();
const safeExtension = /^[a-z0-9]+$/.test(extension) ? extension : "jpg";

const imagePath = `${adminUser.id}/${Date.now()}-${crypto.randomUUID()}.${safeExtension}`;

const { error: uploadError } = await supabase.storage
    .from("marketplace-images")
    .upload(imagePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type
    });

if (uploadError) throw uploadError;

const { data } = supabase.storage
    .from("marketplace-images")
    .getPublicUrl(imagePath);

return {
    image_url: data.publicUrl,
    image_path: imagePath
};

}

async function saveProduct(event) {
event.preventDefault();

const title = $("product-title")?.value.trim();
const price = Number($("product-price")?.value);
const description = $("product-description")?.value.trim();
const productId = $("marketplace-product-id")?.value || "";

if (!title || !description || !Number.isFinite(price) || price < 0) {
    showMessage("Please enter a valid title, price and description.", "error");
    return;
}

if (!productId && !selectedImage) {
    showMessage("Please select a product image.", "error");
    return;
}

setButtonLoading(true);

try {
    const productData = {
        title,
        price,
        description,
        updated_at: new Date().toISOString()
    };

    if (selectedImage) {
        const uploaded = await uploadProductImage(selectedImage);
        productData.image_url = uploaded.image_url;
        productData.image_path = uploaded.image_path;
    }

    if (productId) {
        const { error } = await supabase
            .from("marketplace_products")
            .update(productData)
            .eq("id", productId);

        if (error) throw error;

        showMessage("Product updated successfully.");
    } else {
        productData.created_by = adminUser.id;
        productData.is_active = true;

        const { error } = await supabase
            .from("marketplace_products")
            .insert(productData);

        if (error) throw error;

        showMessage("Product posted successfully.");
    }

    resetForm();
    await loadProducts();

} catch (error) {
    console.error("Marketplace save error:", error);
    showMessage("Unable to save product: " + error.message, "error");
} finally {
    setButtonLoading(false, productId ? "Update Product" : "Post Product");
}

}

function renderProducts() {
const container = $("marketplace-products-list");
if (!container) return;

if (!products.length) {
    container.innerHTML = `
        <div class="admin-empty">
            No marketplace products have been posted yet.
        </div>
    `;
    return;
}

container.innerHTML = products.map(product => `
    <article style="
        background:#fff;
        border:1px solid #e8edf5;
        border-radius:16px;
        overflow:hidden;
        display:flex;
        flex-direction:column;
        box-shadow:0 4px 16px rgba(20,35,70,.05);
    ">
        <img
            src="${escapeHTML(product.image_url)}"
            alt="${escapeHTML(product.title)}"
            loading="lazy"
            style="width:100%;height:190px;object-fit:cover;background:#f1f4f9;"
            onerror="this.style.display='none'"
        >

        <div style="padding:16px;display:flex;flex-direction:column;gap:10px;flex:1;">
            <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">
                <strong style="font-size:16px;color:#17233b;">
                    ${escapeHTML(product.title)}
                </strong>

                <span style="
                    font-size:11px;
                    padding:5px 9px;
                    border-radius:20px;
                    background:${product.is_active ? "#e5f8ef" : "#fff0ed"};
                    color:${product.is_active ? "#13834e" : "#c0392b"};
                ">
                    ${product.is_active ? "Active" : "Hidden"}
                </span>
            </div>

            <strong style="font-size:19px;color:#1f4fe0;">
                ${formatPrice(product.price)}
            </strong>

            <p style="font-size:13px;color:#68758a;line-height:1.6;white-space:pre-wrap;">
                ${escapeHTML(product.description)}
            </p>

            <small style="color:#8a94a6;">
                Posted: ${escapeHTML(new Date(product.created_at).toLocaleDateString("en-NG"))}
            </small>

            <div style="display:flex;gap:8px;margin-top:auto;flex-wrap:wrap;">
                <button
                    type="button"
                    class="admin-small-button"
                    data-marketplace-edit="${escapeHTML(product.id)}"
                >Edit</button>

                <button
                    type="button"
                    class="admin-small-button"
                    data-marketplace-toggle="${escapeHTML(product.id)}"
                >${product.is_active ? "Hide" : "Publish"}</button>

                <button
                    type="button"
                    class="admin-small-button danger"
                    data-marketplace-delete="${escapeHTML(product.id)}"
                >Delete</button>
            </div>
        </div>
    </article>
`).join("");

}

async function loadProducts() {
const container = $("marketplace-products-list");

if (container) {
    container.innerHTML = `
        <div class="admin-loading">Loading marketplace products...</div>
    `;
}

const { data, error } = await supabase
    .from("marketplace_products")
    .select("*")
    .order("created_at", { ascending: false });

if (error) {
    console.error("Marketplace loading error:", error);

    if (container) {
        container.innerHTML = `
            <div class="admin-error">
                ${escapeHTML(error.message)}
            </div>
        `;
    }

    return;
}

products = data || [];
renderProducts();

if ($("stat-products")) {
    $("stat-products").textContent = products.length.toLocaleString();
}

}

function editProduct(productId) {
const product = products.find(item => item.id === productId);
if (!product) return;

editingProduct = product;

$("marketplace-product-id").value = product.id;
$("product-title").value = product.title || "";
$("product-price").value = product.price ?? "";
$("product-description").value = product.description || "";

if ($("marketplace-form-heading")) {
    $("marketplace-form-heading").textContent = "Edit Marketplace Product";
}

if ($("product-submit")) {
    $("product-submit").textContent = "Update Product";
}

if ($("marketplace-cancel-edit")) {
    $("marketplace-cancel-edit").hidden = false;
}

if ($("marketplace-image-preview")) {
    $("marketplace-image-preview").innerHTML = `
        <img
            src="${escapeHTML(product.image_url)}"
            alt="Current product image"
            style="width:100%;max-width:220px;height:160px;object-fit:cover;border-radius:12px;"
        >
        <small>Choose another image if you want to replace this one.</small>
    `;
}

selectedImage = null;

$("marketplace-product-form")?.scrollIntoView({
    behavior: "smooth",
    block: "start"
});

}

async function toggleProduct(productId) {
const product = products.find(item => item.id === productId);
if (!product) return;

const { error } = await supabase
    .from("marketplace_products")
    .update({
        is_active: !product.is_active,
        updated_at: new Date().toISOString()
    })
    .eq("id", productId);

if (error) {
    showMessage("Unable to update product: " + error.message, "error");
    return;
}

showMessage(product.is_active ? "Product hidden." : "Product published.");
await loadProducts();

}

async function deleteProduct(productId) {
const product = products.find(item => item.id === productId);
if (!product) return;

if (!window.confirm(`Delete "${product.title}" permanently?`)) return;

try {
    const { error } = await supabase
        .from("marketplace_products")
        .delete()
        .eq("id", productId);

    if (error) throw error;

    if (product.image_path) {
        const { error: storageError } = await supabase.storage
            .from("marketplace-images")
            .remove([product.image_path]);

        if (storageError) {
            console.warn("Image cleanup warning:", storageError);
        }
    }

    showMessage("Product deleted successfully.");
    await loadProducts();

} catch (error) {
    showMessage("Unable to delete product: " + error.message, "error");
}

}

function setupMarketplaceAdmin() {
$("marketplace-product-form")?.addEventListener("submit", saveProduct);

$("product-image")?.addEventListener("change", event => {
    previewImage(event.target.files?.[0] || null);
});

$("marketplace-cancel-edit")?.addEventListener("click", resetForm);

$("marketplace-refresh")?.addEventListener("click", loadProducts);

$("marketplace-products-list")?.addEventListener("click", async event => {
    const editButton = event.target.closest("[data-marketplace-edit]");
    const toggleButton = event.target.closest("[data-marketplace-toggle]");
    const deleteButton = event.target.closest("[data-marketplace-delete]");

    try {
        if (editButton) {
            editProduct(editButton.dataset.marketplaceEdit);
        } else if (toggleButton) {
            await toggleProduct(toggleButton.dataset.marketplaceToggle);
        } else if (deleteButton) {
            await deleteProduct(deleteButton.dataset.marketplaceDelete);
        }
    } catch (error) {
        console.error("Marketplace action error:", error);
        showMessage(error.message, "error");
    }
});

}

async function initializeMarketplaceAdmin() {
if (!$("marketplace-product-form")) return;

try {
    await verifyAdmin();
    setupMarketplaceAdmin();
    await loadProducts();
} catch (error) {
    console.error("Marketplace admin initialization error:", error);
    showMessage(error.message, "error");
}

}

if (document.readyState === "loading") {
document.addEventListener("DOMContentLoaded", initializeMarketplaceAdmin);
} else {
initializeMarketplaceAdmin();
  }
