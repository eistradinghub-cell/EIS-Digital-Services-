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
        note.textContent = `${items.length} of 4 images selected`;
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
        setButtonLoading(
            false,
            productId ? "Update Product" : "Post Product"
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
        $("stat-products").textContent =
            products.length.toLocaleString();
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

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeMarketplaceAdmin);
} else {
    initializeMarketplaceAdmin();
                    }
