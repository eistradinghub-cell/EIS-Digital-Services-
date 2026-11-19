import { supabase } from "./supabase.js";

const $ = (id) => document.getElementById(id);

let adminUser = null;
let products = [];
let selectedImages = [];
let previewObjectURLs = [];

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
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
    box.style.display = "block";
}

function hideMessage() {
    const box = $("marketplace-form-message");
    if (!box) return;

    box.textContent = "";
    box.style.display = "none";
}

function setButtonLoading(loading, label = "Post Product") {
    const button = $("product-submit");
    if (!button) return;

    button.disabled = loading;
    button.textContent = loading ? "Please wait..." : label;
}

async function verifyAdmin() {
    const { data: { session }, error } =
        await supabase.auth.getSession();

    if (error) throw error;

    if (!session?.user) {
        throw new Error("Your admin session has expired. Please sign in again.");
    }

    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, role")
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
    let images = [];

    if (Array.isArray(product.image_urls)) {
        images = product.image_urls;
    } else if (typeof product.image_urls === "string") {
        try {
            images = JSON.parse(product.image_urls);
        } catch {
            images = [];
        }
    }

    images = images.filter(Boolean).slice(0, 4);

    if (!images.length && product.image_url) {
        images = [product.image_url];
    }

    return images;
}

function getProductPaths(product) {
    let paths = [];

    if (Array.isArray(product.image_paths)) {
        paths = product.image_paths;
    } else if (typeof product.image_paths === "string") {
        try {
            paths = JSON.parse(product.image_paths);
        } catch {
            paths = [];
        }
    }

    paths = paths.filter(Boolean);

    if (!paths.length && product.image_path) {
        paths = [product.image_path];
    }

    return paths;
}

function createPreviewArea() {
    const input = $("product-image");
    if (!input) return null;

    input.multiple = true;
    input.accept = "image/jpeg,image/png,image/webp";

    let gallery = $("marketplace-image-preview-gallery");

    if (!gallery) {
        gallery = document.createElement("div");
        gallery.id = "marketplace-image-preview-gallery";

        gallery.style.display = "grid";
        gallery.style.gridTemplateColumns =
            "repeat(auto-fill,minmax(110px,1fr))";
        gallery.style.gap = "12px";
        gallery.style.marginTop = "15px";

        input.insertAdjacentElement("afterend", gallery);
    }

    const oldPreview = $("marketplace-image-preview");
    if (oldPreview) {
        oldPreview.style.display = "none";
    }

    return gallery;
}

function clearPreviewURLs() {
    previewObjectURLs.forEach((url) => {
        URL.revokeObjectURL(url);
    });

    previewObjectURLs = [];
}

function renderImagePreview(files = [], existingImages = []) {
    const gallery = createPreviewArea();
    if (!gallery) return;

    clearPreviewURLs();
    gallery.innerHTML = "";

    const items = [];

    files.forEach((file) => {
        const url = URL.createObjectURL(file);
        previewObjectURLs.push(url);
        items.push({ url, name: file.name });
    });

    existingImages.forEach((url, index) => {
        items.push({
            url,
            name: `Current image ${index + 1}`
        });
    });

    items.slice(0, 4).forEach((item) => {
        const wrapper = document.createElement("div");

        wrapper.style.border = "1px solid #e2e8f0";
        wrapper.style.borderRadius = "10px";
        wrapper.style.padding = "6px";
        wrapper.style.background = "#fff";

        const image = document.createElement("img");
        image.src = item.url;
        image.alt = item.name;
        image.style.width = "100%";
        image.style.height = "100px";
        image.style.objectFit = "cover";
        image.style.borderRadius = "7px";

        const caption = document.createElement("small");
        caption.textContent = item.name;
        caption.style.display = "block";
        caption.style.marginTop = "5px";
        caption.style.overflowWrap = "anywhere";

        wrapper.append(image, caption);
        gallery.appendChild(wrapper);
    });

    if (items.length) {
        const note = document.createElement("div");
        note.textContent = `${Math.min(items.length, 4)} of 4 images selected`;
        note.style.gridColumn = "1 / -1";
        note.style.fontSize = "12px";
        note.style.color = "#526078";
        gallery.appendChild(note);
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

    selectedImages = [];
    clearPreviewURLs();

    const gallery = $("marketplace-image-preview-gallery");
    if (gallery) gallery.innerHTML = "";

    const oldPreview = $("marketplace-image-preview");
    if (oldPreview) oldPreview.style.display = "none";

    hideMessage();
}

async function uploadProductImage(file) {
    const extension = file.name.split(".").pop().toLowerCase();
    const safeExtension = /^[a-z0-9]+$/.test(extension)
        ? extension
        : "jpg";

    const uniqueId = crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const imagePath =
        `${adminUser.id}/${Date.now()}-${uniqueId}.${safeExtension}`;

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

    if (!data?.publicUrl) {
        throw new Error("Unable to generate product image URL.");
    }

    return {
        image_url: data.publicUrl,
        image_path: imagePath
    };
}

async function uploadSelectedImages() {
    const uploaded = [];

    for (const file of selectedImages) {
        uploaded.push(await uploadProductImage(file));
    }

    return uploaded;
}

async function saveProduct(event) {
    event.preventDefault();
    hideMessage();

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

    if (selectedImages.length > 4) {
        showMessage("You can select a maximum of 4 images.", "error");
        return;
    }

    setButtonLoading(true);

    let uploadedImages = [];

    try {
        const existingProduct = products.find(
            (product) => product.id === productId
        );

        let imageURLs = existingProduct
            ? getProductImages(existingProduct)
            : [];

        let imagePaths = existingProduct
            ? getProductPaths(existingProduct)
            : [];

        if (selectedImages.length) {
            uploadedImages = await uploadSelectedImages();

            imageURLs = uploadedImages.map((image) => image.image_url);
            imagePaths = uploadedImages.map((image) => image.image_path);
        }

        if (!imageURLs.length) {
            throw new Error("Product must have at least one image.");
        }

        const productData = {
            title,
            price,
            description,
            image_url: imageURLs[0],
            image_path: imagePaths[0] || null,
            image_urls: imageURLs,
            image_paths: imagePaths,
            updated_at: new Date().toISOString()
        };

        if (productId) {
            const { error } = await supabase
                .from("marketplace_products")
                .update(productData)
                .eq("id", productId);

            if (error) throw error;

            if (uploadedImages.length && existingProduct) {
                const oldPaths = getProductPaths(existingProduct);

                if (oldPaths.length) {
                    await supabase.storage
                        .from("marketplace-images")
                        .remove(oldPaths);
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

        if (uploadedImages.length) {
            await supabase.storage
                .from("marketplace-images")
                .remove(uploadedImages.map((image) => image.image_path));
        }

        showMessage(
            "Unable to save product: " + (error.message || "Unknown error"),
            "error"
        );

    } finally {
        const isStillEditing = Boolean($("marketplace-product-id")?.value);
        setButtonLoading(
            false,
            isStillEditing ? "Update Product" : "Post Product"
        );
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

    container.innerHTML = products.map((product) => {
        const images = getProductImages(product);
        const firstImage = images[0] || "";

        return `
            <article class="marketplace-admin-card">

                ${firstImage ? `
                    <img
                        src="${escapeHTML(firstImage)}"
                        alt="${escapeHTML(product.title)}"
                        loading="lazy"
                    >
                ` : ""}

                <div class="marketplace-admin-card-content">

                    <h4>${escapeHTML(product.title)}</h4>

                    <span class="marketplace-status"
                        style="${product.is_active
                            ? ""
                            : "background:#fff0ed;color:#c0392b;"}">
                        ${product.is_active ? "Published" : "Hidden"}
                    </span>

                    <div class="marketplace-admin-price">
                        ${formatPrice(product.price)}
                    </div>

                    <p class="marketplace-admin-description">
                        ${escapeHTML(product.description)}
                    </p>

                    <small>${images.length} image(s)</small>

                    <div class="marketplace-admin-actions">

                        <button
                            type="button"
                            class="marketplace-edit-button"
                            data-edit="${escapeHTML(product.id)}"
                        >Edit</button>

                        <button
                            type="button"
                            data-toggle="${escapeHTML(product.id)}"
                        >${product.is_active ? "Hide" : "Publish"}</button>

                        <button
                            type="button"
                            class="marketplace-delete-button"
                            data-delete="${escapeHTML(product.id)}"
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

    try {
        const { data, error } = await supabase
            .from("marketplace_products")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) throw error;

        products = data || [];
        renderProducts();

        if ($("stat-products")) {
            $("stat-products").textContent =
                products.length.toLocaleString();
        }
    } catch (error) {
        console.error("Marketplace loading error:", error);

        if (container) {
            container.innerHTML = `
                <div class="admin-error">
                    ${escapeHTML(error.message || "Please try again.")}
                </div>
            `;
        }
    }
}

function editProduct(productId) {
    const product = products.find((item) => item.id === productId);
    if (!product) return;

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

    renderImagePreview([], getProductImages(product));

    showMessage(
        "Choose up to 4 new images if you want to replace the current images.",
        "success"
    );

    $("marketplace-product-form")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

async function toggleProduct(productId) {
    const product = products.find((item) => item.id === productId);
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
    const product = products.find((item) => item.id === productId);
    if (!product) return;

    if (!window.confirm(`Delete "${product.title}" permanently?`)) return;

    const { error } = await supabase
        .from("marketplace_products")
        .delete()
        .eq("id", productId);

    if (error) {
        showMessage("Unable to delete product: " + error.message, "error");
        return;
    }

    const paths = getProductPaths(product);

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
}

function setupMarketplaceAdmin() {
    const imageInput = $("product-image");

    if (imageInput) {
        imageInput.multiple = true;
        imageInput.accept = "image/jpeg,image/png,image/webp";

        imageInput.addEventListener("change", (event) => {
            const files = Array.from(event.target.files || []);

            if (files.length > 4) {
                showMessage("You can select a maximum of 4 images.", "error");
                imageInput.value = "";
                selectedImages = [];
                renderImagePreview([]);
                return;
            }

            const invalidFile = files.find((file) =>
                !["image/jpeg", "image/png", "image/webp"].includes(file.type)
            );

            if (invalidFile) {
                showMessage("Only JPG, PNG and WEBP images are accepted.", "error");
                imageInput.value = "";
                selectedImages = [];
                renderImagePreview([]);
                return;
            }

            const oversizedFile = files.find(
                (file) => file.size > 5 * 1024 * 1024
            );

            if (oversizedFile) {
                showMessage("Each image must not exceed 5MB.", "error");
                imageInput.value = "";
                selectedImages = [];
                renderImagePreview([]);
                return;
            }

            selectedImages = files;
            hideMessage();
            renderImagePreview(selectedImages);
        });
    }

    $("marketplace-product-form")?.addEventListener("submit", saveProduct);
    $("marketplace-cancel-edit")?.addEventListener("click", resetForm);
    $("marketplace-refresh")?.addEventListener("click", loadProducts);

    $("marketplace-products-list")?.addEventListener("click", async (event) => {
        const editButton = event.target.closest("[data-edit]");
        const toggleButton = event.target.closest("[data-toggle]");
        const deleteButton = event.target.closest("[data-delete]");

        try {
            if (editButton) {
                editProduct(editButton.dataset.edit);
            } else if (toggleButton) {
                await toggleProduct(toggleButton.dataset.toggle);
            } else if (deleteButton) {
                await deleteProduct(deleteButton.dataset.delete);
            }
        } catch (error) {
            console.error("Marketplace action error:", error);
            showMessage(error.message, "error");
        }
    });

    createPreviewArea();
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

/* =========================================================
   EIS SITE SETTINGS
   ========================================================= */

let siteSettingsUser = null;
let siteSettingsProfile = null;
let siteSettingsValues = {
    site_logo: null,
    home_images: {},
    admin_profile: {}
};

const siteSettingsPreviewURLs = [];

const SITE_SETTINGS_CSS = `
#section-site-settings .site-settings-shell {
    width: 100%;
    max-width: 1180px;
    margin: 0 auto;
}

#section-site-settings .site-settings-hero {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    margin-bottom: 24px;
    flex-wrap: wrap;
}

#section-site-settings .site-settings-kicker {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    margin-bottom: 9px;
    color: #2864e8;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 1.7px;
}

#section-site-settings .site-settings-hero h1 {
    margin: 0;
    color: #17243a;
    font-size: clamp(27px, 4vw, 36px);
    font-weight: 850;
    letter-spacing: -1.1px;
}

#section-site-settings .site-settings-hero p {
    margin: 8px 0 0;
    color: #7b879b;
    font-size: 13px;
    line-height: 1.7;
}

#section-site-settings .site-settings-status {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    padding: 11px 15px;
    border: 1px solid #dce8ff;
    border-radius: 30px;
    background: #fff;
    color: #3159b7;
    font-size: 11px;
    font-weight: 800;
    box-shadow: 0 5px 18px rgba(35, 75, 145, .05);
}

#section-site-settings .site-settings-status span {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #17b978;
    box-shadow: 0 0 0 4px rgba(23, 185, 120, .12);
}

#section-site-settings .site-settings-shortcuts {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 22px;
}

#section-site-settings .site-settings-shortcut {
    display: flex;
    align-items: center;
    gap: 11px;
    min-width: 0;
    padding: 15px 13px;
    border: 1px solid #E1E8EB;
    border-radius: 8px;
    background: #fff;
    color: #142D4E;
    text-decoration: none;
    box-shadow: 0 2px 9px rgba(20, 45, 78, .045);
    transition: border-color .18s ease, background .18s ease, box-shadow .18s ease;
}

#section-site-settings .site-settings-shortcut:hover {
    border-color: #168477;
    background: #EAF5F2;
    box-shadow: 0 4px 12px rgba(20, 45, 78, .07);
}

#section-site-settings .site-settings-shortcut-number {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    flex: 0 0 34px;
    border-radius: 7px;
    background: #EAF5F2;
    color: #116B61;
    font-size: 11px;
    font-weight: 700;
}

#section-site-settings .site-settings-shortcut strong,
#section-site-settings .site-settings-shortcut small {
    display: block;
}

#section-site-settings .site-settings-shortcut strong {
    color: #142D4E;
    font-size: 12px;
    font-weight: 600;
}

#section-site-settings .site-settings-shortcut small {
    margin-top: 4px;
    color: #687783;
    font-size: 10px;
}

#section-site-settings .site-settings-feedback {
    margin: 0 0 18px;
    padding: 13px 16px;
    border: 1px solid #ccebd9;
    border-radius: 12px;
    background: #effbf4;
    color: #167447;
    font-size: 12px;
    line-height: 1.6;
}

#section-site-settings .site-settings-feedback.error {
    border-color: #f4caca;
    background: #fff2f2;
    color: #b42318;
}

#section-site-settings .site-settings-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
    gap: 19px;
}

#section-site-settings .site-settings-card {
    min-width: 0;
    padding: 22px;
    border: 1px solid #e7ecf4;
    border-radius: 19px;
    background: #fff;
    box-shadow: 0 7px 25px rgba(22, 45, 85, .045);
}

#section-site-settings .site-settings-card.wide {
    grid-column: 1 / -1;
}

#section-site-settings .site-settings-card-head {
    display: flex;
    align-items: flex-start;
    gap: 13px;
    margin-bottom: 21px;
}

#section-site-settings .site-settings-card-icon {
    display: grid;
    place-items: center;
    width: 43px;
    height: 43px;
    flex: 0 0 43px;
    border-radius: 13px;
    background: #edf3ff;
    color: #2864e8;
    font-size: 20px;
}

#section-site-settings .site-settings-card-head h2 {
    margin: 3px 0 5px;
    color: #17243a;
    font-size: 17px;
    font-weight: 850;
}

#section-site-settings .site-settings-card-head p {
    margin: 0;
    color: #8490a3;
    font-size: 11px;
    line-height: 1.6;
}

#section-site-settings .site-settings-card-label {
    color: #2864e8;
    font-size: 9px;
    font-weight: 900;
    letter-spacing: 1.4px;
}

#section-site-settings .site-settings-form {
    display: grid;
    gap: 17px;
}

#section-site-settings .site-settings-two-column {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 17px;
}

#section-site-settings .site-settings-field label.field-title {
    display: block;
    margin-bottom: 8px;
    color: #35445b;
    font-size: 11px;
    font-weight: 800;
}

#section-site-settings .site-settings-field input[type="text"] {
    width: 100%;
    min-height: 46px;
    padding: 12px 14px;
    border: 1px solid #dce3ed;
    border-radius: 11px;
    outline: none;
    background: #fbfcfe;
    color: #17243a;
    font-size: 13px;
    transition: .2s ease;
}

#section-site-settings .site-settings-field input[type="text"]:focus {
    border-color: #2864e8;
    box-shadow: 0 0 0 3px rgba(40, 100, 232, .1);
    background: #fff;
}

#section-site-settings .site-settings-upload {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 145px;
    padding: 18px;
    border: 1.5px dashed #b9c9e2;
    border-radius: 14px;
    background: #f8faff;
    text-align: center;
    cursor: pointer;
    transition: .2s ease;
}

#section-site-settings .site-settings-upload:hover {
    border-color: #2864e8;
    background: #f0f5ff;
}

#section-site-settings .site-settings-upload-icon {
    display: grid;
    place-items: center;
    width: 39px;
    height: 39px;
    margin-bottom: 9px;
    border-radius: 12px;
    background: #e7efff;
    color: #2864e8;
    font-size: 20px;
}

#section-site-settings .site-settings-upload strong {
    color: #35445b;
    font-size: 12px;
}

#section-site-settings .site-settings-upload small {
    margin-top: 6px;
    color: #8a96a9;
    font-size: 10px;
}

#section-site-settings .site-settings-upload input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    overflow: hidden;
}

#section-site-settings .site-settings-preview-wrap {
    min-width: 0;
}

#section-site-settings .site-settings-preview-title {
    margin-bottom: 8px;
    color: #35445b;
    font-size: 11px;
    font-weight: 800;
}

#section-site-settings .site-settings-preview {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 145px;
    padding: 12px;
    overflow: hidden;
    border: 1px solid #e6ebf3;
    border-radius: 14px;
    background:
        linear-gradient(135deg, #f8faff 25%, #f1f5fb 25%, #f1f5fb 50%, #f8faff 50%, #f8faff 75%, #f1f5fb 75%);
    background-size: 18px 18px;
    color: #97a2b3;
    font-size: 11px;
    text-align: center;
}

#section-site-settings .site-settings-preview img {
    display: block;
    max-width: 100%;
    max-height: 175px;
    object-fit: contain;
    border-radius: 8px;
}

#section-site-settings .site-settings-image-preview img {
    width: 100%;
    height: 145px;
    object-fit: cover;
}

#section-site-settings .site-settings-save {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: fit-content;
    min-height: 43px;
    padding: 11px 18px;
    border: 0;
    border-radius: 11px;
    background: #2864e8;
    color: #fff;
    font-size: 12px;
    font-weight: 850;
    box-shadow: 0 6px 14px rgba(40, 100, 232, .18);
    cursor: pointer;
    transition: .2s ease;
}

#section-site-settings .site-settings-save:hover {
    transform: translateY(-1px);
    background: #1d50c5;
}

#section-site-settings .site-settings-save:disabled {
    opacity: .6;
    cursor: wait;
    transform: none;
}

#section-site-settings .site-settings-home-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 14px;
}

#section-site-settings .site-settings-image-card {
    min-width: 0;
    padding: 13px;
    border: 1px solid #e7ecf4;
    border-radius: 15px;
    background: #fbfcff;
}

#section-site-settings .site-settings-image-card h3 {
    margin: 0 0 10px;
    color: #35445b;
    font-size: 12px;
    font-weight: 850;
}

#section-site-settings .site-settings-image-card .site-settings-upload {
    min-height: 100px;
    padding: 12px;
}

#section-site-settings .site-settings-image-card .site-settings-upload-icon {
    width: 31px;
    height: 31px;
    margin-bottom: 6px;
    font-size: 16px;
}

#section-site-settings .site-settings-image-card .site-settings-preview {
    min-height: 125px;
    margin-top: 11px;
}

#section-site-settings .site-settings-admin-list {
    display: grid;
    gap: 10px;
}

#section-site-settings .site-settings-admin-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 13px;
    border: 1px solid #e8edf5;
    border-radius: 12px;
    background: #fbfcff;
}

#section-site-settings .site-settings-admin-person {
    min-width: 0;
}

#section-site-settings .site-settings-admin-person strong,
#section-site-settings .site-settings-admin-person small {
    display: block;
    overflow-wrap: anywhere;
}

#section-site-settings .site-settings-admin-person strong {
    color: #26364e;
    font-size: 12px;
}

#section-site-settings .site-settings-admin-person small {
    margin-top: 4px;
    color: #8994a7;
    font-size: 10px;
}

#section-site-settings .site-settings-role {
    flex: 0 0 auto;
    padding: 6px 9px;
    border-radius: 20px;
    background: #eaf2ff;
    color: #2864e8;
    font-size: 9px;
    font-weight: 900;
    text-transform: uppercase;
}

#section-site-settings .site-settings-role.super {
    background: #f2eaff;
    color: #7744bd;
}

#section-site-settings .site-settings-notice {
    margin-top: 15px;
    padding: 13px 15px;
    border: 1px solid #f0e3c3;
    border-radius: 12px;
    background: #fffaf0;
    color: #86621f;
    font-size: 10px;
    line-height: 1.7;
}

#section-site-settings .site-settings-account-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 11px;
}

#section-site-settings .site-settings-account-item {
    min-width: 0;
    padding: 14px;
    border: 1px solid #e8edf5;
    border-radius: 12px;
    background: #fbfcff;
}

#section-site-settings .site-settings-account-item span {
    display: block;
    margin-bottom: 7px;
    color: #8a95a8;
    font-size: 10px;
    font-weight: 700;
}

#section-site-settings .site-settings-account-item strong {
    display: block;
    color: #26364e;
    font-size: 12px;
    overflow-wrap: anywhere;
}

#section-site-settings .site-settings-account-status {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: #16834f !important;
}

#section-site-settings .site-settings-account-status::before {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #16a36a;
    content: "";
}

@media (max-width: 850px) {
    #section-site-settings .site-settings-shortcuts {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    #section-site-settings .site-settings-home-grid {
        grid-template-columns: 1fr;
    }

    #section-site-settings .site-settings-image-card {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        align-items: center;
        gap: 12px;
    }

    #section-site-settings .site-settings-image-card h3 {
        grid-column: 1 / -1;
    }

    #section-site-settings .site-settings-image-card .site-settings-preview {
        margin-top: 0;
    }
}

@media (max-width: 650px) {
    #section-site-settings .site-settings-grid,
    #section-site-settings .site-settings-two-column {
        grid-template-columns: 1fr;
    }

    #section-site-settings .site-settings-card.wide {
        grid-column: auto;
    }

    #section-site-settings .site-settings-card {
        padding: 17px;
        border-radius: 16px;
    }

    #section-site-settings .site-settings-hero {
        align-items: flex-start;
    }

    #section-site-settings .site-settings-status {
        font-size: 10px;
    }
}

@media (max-width: 420px) {
    #section-site-settings .site-settings-shortcuts {
        grid-template-columns: 1fr 1fr;
        gap: 8px;
    }

    #section-site-settings .site-settings-shortcut {
        padding: 11px 9px;
        gap: 8px;
    }

    #section-site-settings .site-settings-shortcut-number {
        width: 29px;
        height: 29px;
        flex-basis: 29px;
    }

    #section-site-settings .site-settings-shortcut strong {
        font-size: 10px;
    }

    #section-site-settings .site-settings-shortcut small {
        font-size: 8px;
    }

    #section-site-settings .site-settings-account-grid {
        grid-template-columns: 1fr;
    }
}

#section-site-settings .site-settings-card-head {
    margin-bottom: 0;
}

#section-site-settings .site-settings-card-toggle {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
    text-align: left;
    cursor: pointer;
}

#section-site-settings .site-settings-card-toggle > div:nth-child(2) {
    flex: 1;
    min-width: 0;
}

#section-site-settings .site-settings-card-chevron {
    flex: 0 0 auto;
    margin-left: auto;
    color: #687783;
    font-size: 20px;
    line-height: 1;
    transition: transform .18s ease;
}

#section-site-settings .site-settings-card.is-expanded .site-settings-card-chevron {
    transform: rotate(180deg);
}

#section-site-settings .site-settings-card-content {
    margin-top: 20px;
}

#section-site-settings .site-settings-card-content[hidden] {
    display: none !important;
}

#section-site-settings .site-settings-card-action {
    margin-top: 18px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
}

#section-site-settings .site-settings-card-action p {
    margin: 0;
    color: #74818C;
    font-size: 12px;
    line-height: 1.6;
}

#section-site-settings .site-settings-card-toggle:focus-visible {
    outline: 3px solid rgba(40, 100, 232, .3);
    outline-offset: 5px;
    border-radius: 8px;
}

@media (max-width: 650px) {
    #section-site-settings .site-settings-card-action {
        align-items: stretch;
        flex-direction: column;
    }

    #section-site-settings .site-settings-card-action .admin-primary-button {
        width: 100%;
    }
}
`;

function siteSettingsFeedback(message, type = "success") {
    const box = $("site-settings-feedback");
    if (!box) return;

    box.textContent = message;
    box.className = "site-settings-feedback" +
        (type === "error" ? " error" : "");
    box.hidden = false;

    window.clearTimeout(box._hideTimer);

    box._hideTimer = window.setTimeout(() => {
        box.hidden = true;
    }, 6500);
}

function setSiteSettingsPreview(id, url, emptyText = "No image uploaded yet.") {
    const box = $(id);
    if (!box) return;

    box.replaceChildren();

    if (!url) {
        const text = document.createElement("span");
        text.textContent = emptyText;
        box.appendChild(text);
        return;
    }

    const image = document.createElement("img");
    image.src = url;
    image.alt = "Settings image preview";
    image.loading = "lazy";

    box.appendChild(image);
}

function previewSelectedFile(inputId, previewId, emptyText) {
    const input = $(inputId);
    const file = input?.files?.[0];

    if (!file) return;

    const url = URL.createObjectURL(file);
    siteSettingsPreviewURLs.push(url);

    setSiteSettingsPreview(previewId, url, emptyText);
}

function siteSettingsMarkup() {
    const section = $("section-site-settings");
    if (!section) return;

    section.innerHTML = `
        <div class="site-settings-shell">

            <header class="site-settings-hero">
                <div>
                    
                    <h1>Site Settings</h1>
                    <p>Customize your website identity, homepage visuals and administrator profile from one place.</p>
                </div>

            </header>



            <div
                id="site-settings-feedback"
                class="site-settings-feedback"
                role="status"
                aria-live="polite"
                hidden
            ></div>

            <div class="site-settings-grid">

                <!-- WEBSITE LOGO -->

                <article class="site-settings-card" id="site-brand-card">

                    <div class="site-settings-card-head">
                        <div class="site-settings-card-icon">◈</div>
                        <div>
                            <span class="site-settings-card-label">BRAND IDENTITY</span>
                            <h2>Website Logo</h2>
                            <p>Upload the logo you want to use for your website branding.</p>
                        </div>
                    </div>

                    <form id="site-logo-form" class="site-settings-form">

                        <div class="site-settings-two-column">

                            <div class="site-settings-field">
                                <label class="field-title" for="site-logo-file">
                                    Choose Logo
                                </label>

                                <label class="site-settings-upload" for="site-logo-file">
                                    <span class="site-settings-upload-icon">↑</span>
                                    <strong>Choose logo image</strong>
                                    <small>PNG, JPG or WEBP · Maximum 5MB</small>
                                    <input
                                        type="file"
                                        id="site-logo-file"
                                        accept="image/png,image/jpeg,image/webp"
                                    >
                                </label>
                            </div>

                            <div class="site-settings-preview-wrap">
                                <div class="site-settings-preview-title">
                                    Logo Preview
                                </div>

                                <div id="site-logo-preview" class="site-settings-preview">
                                    No logo uploaded yet.
                                </div>
                            </div>

                        </div>

                        <button
                            type="submit"
                            class="site-settings-save"
                            id="site-logo-save"
                        >
                            Save Website Logo
                        </button>

                    </form>

                </article>

                <!-- HOMEPAGE IMAGES -->

                <article class="site-settings-card wide" id="site-home-card">

                    <div class="site-settings-card-head">
                        <div class="site-settings-card-icon">▧</div>
                        <div>
                            <span class="site-settings-card-label">HOMEPAGE APPEARANCE</span>
                            <h2>Homepage Images</h2>
                            <p>Manage the three homepage image slots. Each image has its own preview.</p>
                        </div>
                    </div>

                    <form id="site-home-images-form" class="site-settings-form">

                        <div class="site-settings-home-grid">

                            <div class="site-settings-image-card">
                                <h3>Homepage Image 01</h3>

                                <label class="site-settings-upload" for="site-home-image-one">
                                    <span class="site-settings-upload-icon">↑</span>
                                    <strong>Choose Image 01</strong>
                                    <small>JPG, PNG or WEBP</small>
                                    <input
                                        type="file"
                                        id="site-home-image-one"
                                        accept="image/png,image/jpeg,image/webp"
                                    >
                                </label>

                                <div
                                    id="site-home-image-one-preview"
                                    class="site-settings-preview site-settings-image-preview"
                                >
                                    Image 01 preview
                                </div>
                            </div>

                            <div class="site-settings-image-card">
                                <h3>Homepage Image 02</h3>

                                <label class="site-settings-upload" for="site-home-image-two">
                                    <span class="site-settings-upload-icon">↑</span>
                                    <strong>Choose Image 02</strong>
                                    <small>JPG, PNG or WEBP</small>
                                    <input
                                        type="file"
                                        id="site-home-image-two"
                                        accept="image/png,image/jpeg,image/webp"
                                    >
                                </label>

                                <div
                                    id="site-home-image-two-preview"
                                    class="site-settings-preview site-settings-image-preview"
                                >
                                    Image 02 preview
                                </div>
                            </div>

                            <div class="site-settings-image-card">
                                <h3>Homepage Image 03</h3>

                                <label class="site-settings-upload" for="site-home-image-three">
                                    <span class="site-settings-upload-icon">↑</span>
                                    <strong>Choose Image 03</strong>
                                    <small>JPG, PNG or WEBP</small>
                                    <input
                                        type="file"
                                        id="site-home-image-three"
                                        accept="image/png,image/jpeg,image/webp"
                                    >
                                </label>

                                <div
                                    id="site-home-image-three-preview"
                                    class="site-settings-preview site-settings-image-preview"
                                >
                                    Image 03 preview
                                </div>
                            </div>

                        </div>

                        <button
                            type="submit"
                            class="site-settings-save"
                            id="site-home-images-save"
                        >
                            Save Homepage Images
                        </button>

                    </form>

                </article>

                <!-- ADMIN PROFILE -->

                <article class="site-settings-card" id="site-profile-card">

                    <div class="site-settings-card-head">
                        <div class="site-settings-card-icon">♙</div>
                        <div>
                            <span class="site-settings-card-label">PUBLIC SUPPORT IDENTITY</span>
                            <h2>Admin Profile</h2>
                            <p>Set the display name and profile picture for the administrator identity.</p>
                        </div>
                    </div>

                    <form id="site-admin-profile-form" class="site-settings-form">

                        <div class="site-settings-field">
                            <label class="field-title" for="site-admin-display-name">
                                Admin Display Name
                            </label>

                            <input
                                type="text"
                                id="site-admin-display-name"
                                maxlength="80"
                                placeholder="Enter admin display name"
                            >
                        </div>

                        <div class="site-settings-two-column">

                            <div class="site-settings-field">
                                <label class="field-title" for="site-admin-avatar-file">
                                    Profile Picture
                                </label>

                                <label class="site-settings-upload" for="site-admin-avatar-file">
                                    <span class="site-settings-upload-icon">↑</span>
                                    <strong>Choose profile picture</strong>
                                    <small>JPG, PNG or WEBP · Maximum 5MB</small>
                                    <input
                                        type="file"
                                        id="site-admin-avatar-file"
                                        accept="image/png,image/jpeg,image/webp"
                                    >
                                </label>
                            </div>

                            <div class="site-settings-preview-wrap">
                                <div class="site-settings-preview-title">
                                    Profile Preview
                                </div>

                                <div
                                    id="site-admin-avatar-preview"
                                    class="site-settings-preview"
                                >
                                    Admin profile preview
                                </div>
                            </div>

                        </div>

                        <button
                            type="submit"
                            class="site-settings-save"
                            id="site-admin-profile-save"
                        >
                            Save Admin Profile
                        </button>

                    </form>

                </article>

                <!-- STAFF ACCESS -->

                <article class="site-settings-card" id="site-admins-card">

                    <div class="site-settings-card-head">
                        <div class="site-settings-card-icon">♧</div>
                        <div>
                            <span class="site-settings-card-label">STAFF ACCESS</span>
                            <h2>Staff &amp; Admin Management</h2>
                            <p>Review administrator access and manage staff permissions.</p>
                        </div>
                    </div>

                    <div class="site-settings-card-action">
                        <p>Administrator roles are managed separately to keep access controls in one place.</p>
                        <button type="button" class="admin-primary-button" data-open-section="staff-management">Manage access →</button>
                    </div>

                </article>

                <!-- CURRENT ACCOUNT -->

                <article class="site-settings-card wide" id="site-account-card">

                    <div class="site-settings-card-head">
                        <div class="site-settings-card-icon">◎</div>
                        <div>
                            <span class="site-settings-card-label">SIGNED-IN ACCOUNT</span>
                            <h2>Current Administrator Account</h2>
                            <p>Details of the administrator currently signed in.</p>
                        </div>
                    </div>

                    <div class="site-settings-account-grid">

                        <div class="site-settings-account-item">
                            <span>Administrator Name</span>
                            <strong id="settings-admin-name">Loading...</strong>
                        </div>

                        <div class="site-settings-account-item">
                            <span>Administrator Email</span>
                            <strong id="settings-admin-email">Loading...</strong>
                        </div>

                        <div class="site-settings-account-item">
                            <span>Account Role</span>
                            <strong id="settings-admin-role">Loading...</strong>
                        </div>

                        <div class="site-settings-account-item">
                            <span>Account Status</span>
                            <strong class="site-settings-account-status">Authenticated</strong>
                        </div>

                    </div>

                </article>

            </div>
        </div>
    `;

    document.querySelectorAll("[data-settings-jump]").forEach((link) => {
        link.addEventListener("click", (event) => {
            const target = document.querySelector(link.getAttribute("href"));
            if (!target) return;

            event.preventDefault();

            target.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        });
    });
}

function setupSiteSettingsDisclosures() {
    const cards = document.querySelectorAll(
        "#section-site-settings .site-settings-card"
    );

    cards.forEach((card, index) => {
        const header = card.querySelector(":scope > .site-settings-card-head");
        if (!header || card.dataset.disclosureReady === "true") return;

        const title = header.querySelector("h2")?.textContent.trim() || `Settings ${index + 1}`;
        const content = document.createElement("div");
        content.className = "site-settings-card-content";
        content.id = `site-settings-content-${index + 1}`;

        while (header.nextSibling) {
            content.append(header.nextSibling);
        }

        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "site-settings-card-toggle";
        toggle.setAttribute("aria-controls", content.id);
        toggle.setAttribute("aria-expanded", "false");

        while (header.firstChild) {
            toggle.append(header.firstChild);
        }

        const indicator = document.createElement("span");
        indicator.className = "site-settings-card-chevron";
        indicator.setAttribute("aria-hidden", "true");
        indicator.textContent = "⌄";
        toggle.append(indicator);

        header.replaceChildren(toggle);
        content.hidden = true;
        card.append(content);

        toggle.addEventListener("click", () => {
            const expanded = toggle.getAttribute("aria-expanded") === "true";
            toggle.setAttribute("aria-expanded", String(!expanded));
            content.hidden = expanded;
            card.classList.toggle("is-expanded", !expanded);
        });

        card.dataset.disclosureReady = "true";
        card.dataset.settingsTitle = title;
    });
}

function parseSiteSettingValue(value) {
    if (typeof value === "string") {
        try {
            return JSON.parse(value);
        } catch {
            return value;
        }
    }

    return value || {};
}

async function loadSiteSettingsValues() {
    const { data, error } = await supabase
        .from("site_settings")
        .select("setting_key, setting_value")
        .in("setting_key", [
            "site_logo",
            "home_images",
            "admin_profile"
        ]);

    if (error) throw error;

    siteSettingsValues = {
        site_logo: null,
        home_images: {},
        admin_profile: {}
    };

    (data || []).forEach((row) => {
        siteSettingsValues[row.setting_key] =
            parseSiteSettingValue(row.setting_value);
    });

    const logo = siteSettingsValues.site_logo;
    const images = siteSettingsValues.home_images || {};
    const profile = siteSettingsValues.admin_profile || {};

    setSiteSettingsPreview(
        "site-logo-preview",
        logo?.url || "",
        "No website logo has been saved yet."
    );

    setSiteSettingsPreview(
        "site-home-image-one-preview",
        images.image1?.url || "",
        "Homepage Image 01"
    );

    setSiteSettingsPreview(
        "site-home-image-two-preview",
        images.image2?.url || "",
        "Homepage Image 02"
    );

    setSiteSettingsPreview(
        "site-home-image-three-preview",
        images.image3?.url || "",
        "Homepage Image 03"
    );

    setSiteSettingsPreview(
        "site-admin-avatar-preview",
        profile.avatar?.url || "",
        "No admin profile picture has been saved."
    );

    if ($("site-admin-display-name")) {
        $("site-admin-display-name").value =
            profile.displayName ||
            siteSettingsProfile?.full_name ||
            "";
    }
}

async function saveSiteSetting(key, value) {
    if (!siteSettingsUser?.id) {
        throw new Error("Your administrator session is not available.");
    }

    const { error } = await supabase
        .from("site_settings")
        .upsert({
            setting_key: key,
            setting_value: value,
            updated_by: siteSettingsUser.id
        }, {
            onConflict: "setting_key"
        });

    if (error) throw error;
}

async function uploadSiteAsset(file, folder) {
    if (!file) {
        throw new Error("Please choose an image first.");
    }

    const allowedTypes = [
        "image/png",
        "image/jpeg",
        "image/webp"
    ];

    if (!allowedTypes.includes(file.type)) {
        throw new Error("Only PNG, JPG and WEBP images are accepted.");
    }

    if (file.size > 5 * 1024 * 1024) {
        throw new Error("The image must not exceed 5MB.");
    }

    const extensionByType = {
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/webp": "webp"
    };

    const extension = extensionByType[file.type];
    const uniqueId = crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const path =
        `site-settings/${folder}/${Date.now()}-${uniqueId}.${extension}`;

    const { error } = await supabase.storage
        .from("site-assets")
        .upload(path, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type
        });

    if (error) throw error;

    const { data } = supabase.storage
        .from("site-assets")
        .getPublicUrl(path);

    if (!data?.publicUrl) {
        throw new Error("Unable to create a public image URL.");
    }

    return {
        url: data.publicUrl,
        path,
        filename: file.name
    };
}

function setSettingsButton(button, loading, originalText) {
    if (!button) return;

    button.disabled = loading;
    button.textContent = loading ? "Saving..." : originalText;
}

async function saveSiteLogo(event) {
    event.preventDefault();

    const button = $("site-logo-save");
    setSettingsButton(button, true, "Save Website Logo");

    try {
        const file = $("site-logo-file")?.files?.[0];

        if (!file) {
            throw new Error("Please choose a website logo.");
        }

        const uploaded = await uploadSiteAsset(file, "logo");

        const logoValue = {
            ...uploaded,
            updatedAt: new Date().toISOString()
        };

        await saveSiteSetting("site_logo", logoValue);

        siteSettingsValues.site_logo = logoValue;

        setSiteSettingsPreview(
            "site-logo-preview",
            logoValue.url,
            "Website logo preview"
        );

        $("site-logo-form")?.reset();

        siteSettingsFeedback("Website logo saved successfully.");

    } catch (error) {
        console.error("Site logo save error:", error);
        siteSettingsFeedback(
            error.message || "Unable to save website logo.",
            "error"
        );

    } finally {
        setSettingsButton(button, false, "Save Website Logo");
    }
}

async function saveHomepageImages(event) {
    event.preventDefault();

    const button = $("site-home-images-save");
    setSettingsButton(button, true, "Save Homepage Images");

    try {
        const currentImages = {
            ...(siteSettingsValues.home_images || {})
        };

        const imageInputs = [
            {
                input: "site-home-image-one",
                key: "image1",
                preview: "site-home-image-one-preview",
                folder: "homepage-image-1"
            },
            {
                input: "site-home-image-two",
                key: "image2",
                preview: "site-home-image-two-preview",
                folder: "homepage-image-2"
            },
            {
                input: "site-home-image-three",
                key: "image3",
                preview: "site-home-image-three-preview",
                folder: "homepage-image-3"
            }
        ];

        let changed = false;

        for (const item of imageInputs) {
            const file = $(item.input)?.files?.[0];

            if (!file) continue;

            const uploaded = await uploadSiteAsset(file, item.folder);

            currentImages[item.key] = {
                ...uploaded,
                updatedAt: new Date().toISOString()
            };

            changed = true;
        }

        if (!changed) {
            throw new Error("Choose at least one homepage image to update.");
        }

        await saveSiteSetting("home_images", currentImages);

        siteSettingsValues.home_images = currentImages;

        setSiteSettingsPreview(
            "site-home-image-one-preview",
            currentImages.image1?.url || "",
            "Homepage Image 01"
        );

        setSiteSettingsPreview(
            "site-home-image-two-preview",
            currentImages.image2?.url || "",
            "Homepage Image 02"
        );

        setSiteSettingsPreview(
            "site-home-image-three-preview",
            currentImages.image3?.url || "",
            "Homepage Image 03"
        );

        $("site-home-images-form")?.reset();

        siteSettingsFeedback("Homepage images saved successfully.");

    } catch (error) {
        console.error("Homepage images save error:", error);
        siteSettingsFeedback(
            error.message || "Unable to save homepage images.",
            "error"
        );

    } finally {
        setSettingsButton(button, false, "Save Homepage Images");
    }
}

async function saveAdminSiteProfile(event) {
    event.preventDefault();

    const button = $("site-admin-profile-save");
    setSettingsButton(button, true, "Save Admin Profile");

    try {
        const currentProfileSettings =
            siteSettingsValues.admin_profile || {};

        const displayName =
            $("site-admin-display-name")?.value.trim() || "";

        const avatarFile =
            $("site-admin-avatar-file")?.files?.[0] || null;

        if (!displayName && !avatarFile && !currentProfileSettings.avatar?.url) {
            throw new Error("Enter an admin display name or choose a profile picture.");
        }

        const updatedProfile = {
            ...currentProfileSettings,
            displayName:
                displayName ||
                currentProfileSettings.displayName ||
                siteSettingsProfile?.full_name ||
                ""
        };

        if (avatarFile) {
            updatedProfile.avatar = await uploadSiteAsset(
                avatarFile,
                "admin-profile"
            );
        }

        updatedProfile.updatedAt = new Date().toISOString();

        await saveSiteSetting("admin_profile", updatedProfile);

        siteSettingsValues.admin_profile = updatedProfile;

        setSiteSettingsPreview(
            "site-admin-avatar-preview",
            updatedProfile.avatar?.url || "",
            "Admin profile picture"
        );

        $("site-admin-avatar-file").value = "";

        siteSettingsFeedback("Admin profile settings saved successfully.");

    } catch (error) {
        console.error("Admin profile save error:", error);
        siteSettingsFeedback(
            error.message || "Unable to save admin profile.",
            "error"
        );

    } finally {
        setSettingsButton(button, false, "Save Admin Profile");
    }
}

async function loadSiteAdministrators() {
    const container = $("site-admins-list");
    if (!container) return;

    container.innerHTML = `
        <div class="admin-loading">Loading administrator accounts...</div>
    `;

    try {
        const { data, error } = await supabase
            .from("profiles")
            .select("id,email,full_name,role")
            .in("role", ["admin", "super_admin"])
            .order("full_name", { ascending: true });

        if (error) throw error;

        const administrators = data || [];

        if (!administrators.length) {
            container.innerHTML = `
                <div class="admin-empty">
                    No administrator accounts were found.
                </div>
            `;
            return;
        }

        container.innerHTML = administrators.map((item) => {
            const role = String(item.role || "admin").toLowerCase();
            const isSuper = role === "super_admin";

            return `
                <article class="site-settings-admin-row">

                    <div class="site-settings-admin-person">
                        <strong>
                            ${escapeHTML(
                                item.full_name ||
                                item.email ||
                                "Administrator"
                            )}
                        </strong>

                        <small>${escapeHTML(item.email || "Email unavailable")}</small>
                    </div>

                    <span class="site-settings-role ${isSuper ? "super" : ""}">
                        ${escapeHTML(role.replace("_", " "))}
                    </span>

                </article>
            `;
        }).join("");

    } catch (error) {
        console.error("Administrator list error:", error);

        container.innerHTML = `
            <div class="admin-error">
                Unable to load administrator accounts.
                ${escapeHTML(error.message || "")}
            </div>
        `;
    }
}

function updateCurrentAdminInformation() {
    if (!siteSettingsProfile || !siteSettingsUser) return;

    const name =
        siteSettingsProfile.full_name ||
        siteSettingsUser.user_metadata?.full_name ||
        siteSettingsUser.email ||
        "Administrator";

    const email =
        siteSettingsProfile.email ||
        siteSettingsUser.email ||
        "Email unavailable";

    const role =
        siteSettingsProfile.role ||
        "admin";

    if ($("settings-admin-name")) {
        $("settings-admin-name").textContent = name;
    }

    if ($("settings-admin-email")) {
        $("settings-admin-email").textContent = email;
    }

    if ($("settings-admin-role")) {
        $("settings-admin-role").textContent =
            String(role).replace("_", " ");
    }
}

function setupSiteSettingsEvents() {
    $("site-logo-form")?.addEventListener("submit", saveSiteLogo);

    $("site-home-images-form")?.addEventListener(
        "submit",
        saveHomepageImages
    );

    $("site-admin-profile-form")?.addEventListener(
        "submit",
        saveAdminSiteProfile
    );

    $("site-logo-file")?.addEventListener("change", () => {
        previewSelectedFile(
            "site-logo-file",
            "site-logo-preview",
            "Website logo preview"
        );
    });

    $("site-home-image-one")?.addEventListener("change", () => {
        previewSelectedFile(
            "site-home-image-one",
            "site-home-image-one-preview",
            "Homepage Image 01"
        );
    });

    $("site-home-image-two")?.addEventListener("change", () => {
        previewSelectedFile(
            "site-home-image-two",
            "site-home-image-two-preview",
            "Homepage Image 02"
        );
    });

    $("site-home-image-three")?.addEventListener("change", () => {
        previewSelectedFile(
            "site-home-image-three",
            "site-home-image-three-preview",
            "Homepage Image 03"
        );
    });

    $("site-admin-avatar-file")?.addEventListener("change", () => {
        previewSelectedFile(
            "site-admin-avatar-file",
            "site-admin-avatar-preview",
            "Admin profile picture"
        );
    });

    $("site-admins-refresh")?.addEventListener(
        "click",
        loadSiteAdministrators
    );
}

async function initializeSiteSettings() {
    const section = $("section-site-settings");
    if (!section) return;

    if (!$("site-settings-styles")) {
        const style = document.createElement("style");
        style.id = "site-settings-styles";
        style.textContent = SITE_SETTINGS_CSS;
        document.head.appendChild(style);
    }

    siteSettingsMarkup();
    setupSiteSettingsDisclosures();
    setupSiteSettingsEvents();

    try {
        const {
            data: { session },
            error: sessionError
        } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        if (!session?.user) {
            throw new Error("Please sign in again to manage Site Settings.");
        }

        siteSettingsUser = session.user;

        const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("id,email,full_name,role")
            .eq("id", siteSettingsUser.id)
            .single();

        if (profileError) throw profileError;

        if (
            !profile ||
            !["admin", "super_admin"].includes(
                String(profile.role || "").toLowerCase()
            )
        ) {
            throw new Error("Administrator permission is required.");
        }

        siteSettingsProfile = profile;

        updateCurrentAdminInformation();

        await loadSiteSettingsValues();
        await loadSiteAdministrators();

    } catch (error) {
        console.error("Site Settings initialization error:", error);

        siteSettingsFeedback(
            error.message || "Unable to load Site Settings.",
            "error"
        );
    }
}

/* =========================================================
   INITIALIZE ADMIN PAGE MODULES
   ========================================================= */

function initializeAdminPageModules() {
    initializeMarketplaceAdmin();
    initializeSiteSettings();
}

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        initializeAdminPageModules,
        { once: true }
    );
} else {
    initializeAdminPageModules();
    }
