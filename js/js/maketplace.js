import { supabase } from "./supabase.js";

const $ = (id) => document.getElementById(id);

let adminUser = null;
let products = [];
let selectedImages = [];
let editingProduct = null;

const MAX_IMAGES = 4;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
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
    box.className = "marketplace-form-message " + type;
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

function getProductImages(product) {
    let urls = [];

    if (Array.isArray(product.image_urls)) {
        urls = product.image_urls.filter(Boolean);
    }

    if (!urls.length && product.image_url) {
        urls = [product.image_url];
    }

    return urls.slice(0, MAX_IMAGES);
}

function getProductImagePaths(product) {
    if (Array.isArray(product.image_paths)) {
        return product.image_paths.filter(Boolean);
    }

    return product.image_path ? [product.image_path] : [];
}

function createPreviewContainer() {
    const input = $("product-image");
    if (!input) return null;

    let container = $("marketplace-image-gallery-preview");

    if (!container) {
        container = document.createElement("div");
        container.id = "marketplace-image-gallery-preview";

        container.style.cssText = `
            display:grid;
            grid-template-columns:repeat(4,minmax(0,1fr));
            gap:10px;
            margin-top:14px;
        `;

        input.insertAdjacentElement("afterend", container);
    }

    return container;
}

function renderImagePreviews(files = [], existingUrls = []) {
    const container = createPreviewContainer();
    if (!container) return;

    container.innerHTML = "";

    const urls = [
        ...existingUrls,
        ...files.map(file => URL.createObjectURL(file))
    ].slice(0, MAX_IMAGES);

    urls.forEach((url, index) => {
        const wrapper = document.createElement("div");

        wrapper.style.cssText = `
            position:relative;
            width:100%;
            aspect-ratio:1;
            overflow:hidden;
            border-radius:10px;
            border:1px solid #dce2ec;
            background:#f3f5f9;
        `;

        const image = document.createElement("img");
        image.src = url;
        image.alt = `Product image ${index + 1}`;

        image.style.cssText = `
            width:100%;
            height:100%;
            object-fit:cover;
        `;

        wrapper.appendChild(image);
        container.appendChild(wrapper);
    });

    if (!urls.length) {
        container.innerHTML = "";
    }
}

function validateImages(files) {
    if (files.length > MAX_IMAGES) {
        throw new Error("You can upload a maximum of 4 images per product.");
    }

    for (const file of files) {
        if (!ALLOWED_TYPES.includes(file.type)) {
            throw new Error("Only JPG, PNG and WEBP images are allowed.");
        }

        if (file.size > MAX_IMAGE_SIZE) {
            throw new Error("Each image must not exceed 5MB.");
        }
    }
}

function resetForm() {
    $("marketplace-product-form")?.reset();

    if ($("marketplace-product-id")) {
        $("marketplace-product-id").value = "";
    }

    if ($("marketplace-form-heading")) {
        $("marketplace-form-heading").textContent = "Product Information";
    }

    if ($("product-submit")) {
        $("product-submit").textContent = "Post Product";
    }

    if ($("marketplace-cancel-edit")) {
        $("marketplace-cancel-edit").hidden = true;
    }

    const preview = $("marketplace-image-preview");
    if (preview) {
        preview.src = "";
        preview.style.display = "none";
    }

    const gallery = $("marketplace-image-gallery-preview");
    if (gallery) gallery.innerHTML = "";

    const input = $("product-image");
    if (input) input.value = "";

    selectedImages = [];
    editingProduct = null;
}

async function uploadProductImage(file) {
    const extension = file.name.split(".").pop().toLowerCase();
    const safeExtension = /^[a-z0-9]+$/.test(extension) ? extension : "jpg";

    const imagePath =
        `${adminUser.id}/${Date.now()}-${crypto.randomUUID()}.${safeExtension}`;

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

async function uploadSelectedImages() {
    const uploadedImages = [];

    for (const file of selectedImages) {
        const uploaded = await uploadProductImage(file);
        uploadedImages.push(uploaded);
    }

    return uploadedImages;
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

    if (!productId && selectedImages.length === 0) {
        showMessage("Please select at least one product image.", "error");
        return;
    }

    if (selectedImages.length > MAX_IMAGES) {
        showMessage("You can upload a maximum of 4 images.", "error");
        return;
    }

    setButtonLoading(true);

    let newlyUploaded = [];

    try {
        const oldProduct = editingProduct;
        let imageUrls = oldProduct ? getProductImages(oldProduct) : [];
        let imagePaths = oldProduct ? getProductImagePaths(oldProduct) : [];

        if (selectedImages.length) {
            newlyUploaded = await uploadSelectedImages();

            imageUrls = newlyUploaded.map(item => item.image_url);
            imagePaths = newlyUploaded.map(item => item.image_path);
        }

        if (!imageUrls.length) {
            throw new Error("Please upload at least one product image.");
        }

        const productData = {
            title,
            price,
            description,
            image_url: imageUrls[0],
            image_path: imagePaths[0] || null,
            image_urls: imageUrls,
            image_paths: imagePaths,
            updated_at: new Date().toISOString()
        };

        if (productId) {
            const { error } = await supabase
                .from("marketplace_products")
                .update(productData)
                .eq("id", productId);

            if (error) throw error;

            if (selectedImages.length && oldProduct) {
                const oldPaths = getProductImagePaths(oldProduct);

                if (oldPaths.length) {
                    const { error: removeError } = await supabase.storage
                        .from("marketplace-images")
                        .remove(oldPaths);

                    if (removeError) {
                        console.warn("Old image cleanup warning:", removeError);
                    }
                }
            }

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

        if (newlyUploaded.length) {
            const paths = newlyUploaded.map(item => item.image_path);

            await supabase.storage
                .from("marketplace-images")
                .remove(paths);
        }

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

    container.innerHTML = products.map(product => {
        const images = getProductImages(product);

        return `
            <article style="
                background:#fff;
                border:1px solid #e8edf5;
                border-radius:16px;
                overflow:hidden;
                display:flex;
                flex-direction:column;
                box-shadow:0 4px 16px rgba(20,35,70,.05);
            ">

                <div style="
                    display:grid;
                    grid-template-columns:repeat(2,minmax(0,1fr));
                    gap:3px;
                    background:#f1f4f9;
                ">
                    ${images.map((url, index) => `
                        <img
                            src="${escapeHTML(url)}"
                            alt="${escapeHTML(product.title)} image ${index + 1}"
                            loading="lazy"
                            style="
                                width:100%;
                                height:130px;
                                object-fit:cover;
                                background:#f1f4f9;
                            "
                        >
                    `).join("")}
                </div>

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

                    <p style="
                        font-size:13px;
                        color:#68758a;
                        line-height:1.6;
                        white-space:pre-wrap;
                    ">
                        ${escapeHTML(product.description)}
                    </p>

                    <small style="color:#8a94a6;">
                        ${images.length} image(s) · Posted:
                        ${escapeHTML(new Date(product.created_at).toLocaleDateString("en-NG"))}
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
        `;
    }).join("");
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

    selectedImages = [];

    const input = $("product-image");
    if (input) input.value = "";

    renderImagePreviews([], getProductImages(product));

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

        const paths = getProductImagePaths(product);

        if (paths.length) {
            const { error: storageError } = await supabase.storage
                .from("marketplace-images")
                .remove(paths);

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
    const imageInput = $("product-image");

    if (imageInput) {
        imageInput.multiple = true;
        imageInput.accept = "image/jpeg,image/png,image/webp";

        imageInput.addEventListener("change", event => {
            try {
                const files = Array.from(event.target.files || []);

                validateImages(files);

                selectedImages = files;
                renderImagePreviews(files);

                if (files.length) {
                    showMessage(`${files.length} image(s) selected.`);
                }
            } catch (error) {
                selectedImages = [];
                imageInput.value = "";
                renderImagePreviews([]);
                showMessage(error.message, "error");
            }
        });
    }

    $("marketplace-product-form")?.addEventListener("submit", saveProduct);

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
