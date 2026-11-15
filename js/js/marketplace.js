import { supabase } from "./supabase.js";

const productsContainer = document.getElementById("marketplace-products");
const searchInput = document.getElementById("marketplace-search");

let allProducts = [];

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        };

        return entities[character];
    });
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

    images = images
        .filter((url) => typeof url === "string" && url.trim())
        .slice(0, 4);

    if (!images.length && product.image_url) {
        images = [product.image_url];
    }

    return [...new Set(images)];
}

function formatPrice(price) {
    const amount = Number(price);

    if (!Number.isFinite(amount)) {
        return "Price unavailable";
    }

    return new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: "NGN",
        maximumFractionDigits: 2
    }).format(amount);
}

function formatDate(date) {
    if (!date) return "";

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
        return "";
    }

    return parsedDate.toLocaleDateString("en-NG", {
        day: "numeric",
        month: "short",
        year: "numeric"
    });
}

function showMessage(message, type = "empty") {
    productsContainer.innerHTML = `
        <div class="marketplace-${type}">
            ${escapeHTML(message)}
        </div>
    `;
}

function renderProducts(products) {
    if (!products.length) {
        showMessage("No products found.");
        return;
    }

    productsContainer.innerHTML = products.map((product) => {
        const images = getProductImages(product);

        const firstImage = images[0] || "";

        const safeTitle = escapeHTML(product.title);
        const safeDescription = escapeHTML(product.description);
        const safePrice = formatPrice(product.price);
        const safeDate = formatDate(product.created_at);

        const imageGallery = firstImage
            ? `
                <div class="marketplace-gallery">

                    <img
                        class="marketplace-main-image"
                        src="${escapeHTML(firstImage)}"
                        alt="${safeTitle}"
                        loading="lazy"
                        data-main-image
                    >

                    ${images.length > 1
                        ? `<span class="marketplace-image-count">${images.length} Images</span>`
                        : ""
                    }

                    ${images.length > 1
                        ? `
                            <div class="marketplace-thumbnails">
                                ${images.map((image, index) => `
                                    <img
                                        src="${escapeHTML(image)}"
                                        alt="${safeTitle} image ${index + 1}"
                                        class="marketplace-thumbnail ${index === 0 ? "active" : ""}"
                                        loading="lazy"
                                        data-thumbnail
                                        data-image="${escapeHTML(image)}"
                                        title="View image ${index + 1}"
                                    >
                                `).join("")}
                            </div>
                        `
                        : ""
                    }

                </div>
            `
            : `
                <div class="marketplace-gallery">
                    <div class="marketplace-empty">
                        No product image available.
                    </div>
                </div>
            `;

        const downloadButtons = images.map((image, index) => `
            <button
                type="button"
                class="marketplace-download"
                data-download="${escapeHTML(image)}"
                data-filename="${escapeHTML(product.title)}-${index + 1}"
                style="margin-top:8px;"
            >
                Download Image ${index + 1}
            </button>
        `).join("");

        return `
            <article class="marketplace-card" data-product-card>

                ${imageGallery}

                <div class="marketplace-card-content">

                    <h3>${safeTitle}</h3>

                    <div class="marketplace-price">
                        ${escapeHTML(safePrice)}
                    </div>

                    <p class="marketplace-description">
                        ${safeDescription}
                    </p>

                    ${downloadButtons}

                    ${safeDate
                        ? `<span class="marketplace-date">Posted: ${escapeHTML(safeDate)}</span>`
                        : ""
                    }

                </div>

            </article>
        `;
    }).join("");
}

function searchProducts() {
    const searchTerm = searchInput.value.trim().toLowerCase();

    const filteredProducts = allProducts.filter((product) => {
        const title = String(product.title || "").toLowerCase();
        const description = String(product.description || "").toLowerCase();

        return title.includes(searchTerm) ||
            description.includes(searchTerm);
    });

    renderProducts(filteredProducts);
}

async function downloadImage(url, filename, button) {
    if (!url) return;

    const originalText = button.textContent;

    button.disabled = true;
    button.textContent = "Downloading...";

    try {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("Image download failed.");
        }

        const blob = await response.blob();
        const objectURL = URL.createObjectURL(blob);

        const link = document.createElement("a");

        link.href = objectURL;
        link.download = `${filename}.jpg`;

        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(() => {
            URL.revokeObjectURL(objectURL);
        }, 2000);

        button.textContent = "Downloaded";

    } catch (error) {
        console.error("Download error:", error);

        button.textContent = "Open Image";

        window.open(url, "_blank", "noopener,noreferrer");

    } finally {
        setTimeout(() => {
            button.disabled = false;
            button.textContent = originalText;
        }, 1800);
    }
}

function setupGalleryEvents() {

    productsContainer.addEventListener("click", (event) => {

        const thumbnail = event.target.closest("[data-thumbnail]");

        if (thumbnail) {
            const card = thumbnail.closest("[data-product-card]");
            const mainImage = card.querySelector("[data-main-image]");

            if (mainImage) {
                mainImage.src = thumbnail.dataset.image;
            }

            card.querySelectorAll("[data-thumbnail]").forEach((item) => {
                item.classList.remove("active");
            });

            thumbnail.classList.add("active");
            return;
        }

        const downloadButton = event.target.closest("[data-download]");

        if (downloadButton) {
            downloadImage(
                downloadButton.dataset.download,
                downloadButton.dataset.filename || "EIS-Product",
                downloadButton
            );
        }

    });
}

async function loadProducts() {
    showMessage("Loading products...", "loading");

    try {
        const { data, error } = await supabase
            .from("marketplace_products")
            .select("*")
            .eq("is_active", true)
            .order("created_at", { ascending: false });

        if (error) {
            throw error;
        }

        allProducts = data || [];

        renderProducts(allProducts);

    } catch (error) {
        console.error("Marketplace loading error:", error);

        showMessage(
            "Unable to load products. Please refresh the page and try again.",
            "error"
        );
    }
}

if (searchInput) {
    searchInput.addEventListener("input", searchProducts);
}

setupGalleryEvents();
loadProducts();
