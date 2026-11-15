import { supabase } from "./supabase.js";

const productsContainer = document.getElementById("marketplace-products");
const searchInput = document.getElementById("marketplace-search");

let allProducts = [];
const sliderTimers = new Map();

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
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

    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) return "";

    return parsed.toLocaleDateString("en-NG", {
        day: "numeric",
        month: "short",
        year: "numeric"
    });
}

function showMessage(message, type = "empty") {
    stopAllSliders();

    productsContainer.innerHTML = `
        <div class="marketplace-${type}">
            ${escapeHTML(message)}
        </div>
    `;
}

function stopAllSliders() {
    sliderTimers.forEach((timer) => clearInterval(timer));
    sliderTimers.clear();
}

function setSliderImage(card, index) {
    const images = JSON.parse(card.dataset.images || "[]");

    if (!images.length) return;

    const safeIndex = (index + images.length) % images.length;
    card.dataset.currentIndex = String(safeIndex);

    const mainImage = card.querySelector("[data-main-image]");
    const counter = card.querySelector("[data-image-counter]");
    const dots = card.querySelectorAll("[data-slide-dot]");
    const downloadButton = card.querySelector("[data-download]");

    if (mainImage) {
        mainImage.style.opacity = "0.35";
        mainImage.src = images[safeIndex];

        mainImage.onload = () => {
            mainImage.style.opacity = "1";
        };

        mainImage.onerror = () => {
            mainImage.style.opacity = "1";
            mainImage.alt = "Image unavailable";
        };
    }

    if (counter) {
        counter.textContent = `${safeIndex + 1} / ${images.length}`;
    }

    dots.forEach((dot, dotIndex) => {
        dot.classList.toggle("active", dotIndex === safeIndex);
        dot.setAttribute(
            "aria-current",
            dotIndex === safeIndex ? "true" : "false"
        );
    });

    if (downloadButton) {
        downloadButton.dataset.download = images[safeIndex];
        downloadButton.dataset.filename =
            `EIS-Product-Image-${safeIndex + 1}`;
    }
}

function moveSlider(card, direction) {
    const current = Number(card.dataset.currentIndex || 0);
    setSliderImage(card, current + direction);
}

function startSlider(card) {
    const images = JSON.parse(card.dataset.images || "[]");

    if (images.length < 2) return;

    stopSlider(card);

    const timer = setInterval(() => {
        if (document.hidden || card.matches(":hover") ||
            card.contains(document.activeElement)) {
            return;
        }

        moveSlider(card, 1);
    }, 3500);

    sliderTimers.set(card, timer);
}

function stopSlider(card) {
    const timer = sliderTimers.get(card);

    if (timer) {
        clearInterval(timer);
        sliderTimers.delete(card);
    }
}

function createProductCard(product) {
    const images = getProductImages(product);

    const safeTitle = escapeHTML(product.title);
    const safeDescription = escapeHTML(product.description);
    const safePrice = escapeHTML(formatPrice(product.price));
    const safeDate = escapeHTML(formatDate(product.created_at));

    const imageSection = images.length
        ? `
            <div
                class="marketplace-gallery"
                data-slider-card
                data-images="${escapeHTML(JSON.stringify(images))}"
                data-current-index="0"
                style="position:relative;overflow:hidden;"
            >

                <img
                    class="marketplace-main-image"
                    data-main-image
                    src="${escapeHTML(images[0])}"
                    alt="${safeTitle}"
                    loading="lazy"
                    style="transition:opacity .25s ease;"
                >

                ${images.length > 1 ? `
                    <span
                        class="marketplace-image-count"
                        data-image-counter
                    >1 / ${images.length}</span>

                    <button
                        type="button"
                        data-slide-prev
                        aria-label="Previous product image"
                        style="
                            position:absolute;
                            top:45%;
                            left:9px;
                            width:36px;
                            height:36px;
                            border:0;
                            border-radius:50%;
                            background:rgba(0,0,0,.58);
                            color:white;
                            font-size:22px;
                            cursor:pointer;
                        "
                    >‹</button>

                    <button
                        type="button"
                        data-slide-next
                        aria-label="Next product image"
                        style="
                            position:absolute;
                            top:45%;
                            right:9px;
                            width:36px;
                            height:36px;
                            border:0;
                            border-radius:50%;
                            background:rgba(0,0,0,.58);
                            color:white;
                            font-size:22px;
                            cursor:pointer;
                        "
                    >›</button>

                    <div
                        class="marketplace-slider-dots"
                        style="
                            display:flex;
                            justify-content:center;
                            gap:7px;
                            padding:10px;
                        "
                    >
                        ${images.map((image, index) => `
                            <button
                                type="button"
                                data-slide-dot="${index}"
                                aria-label="Show image ${index + 1}"
                                class="${index === 0 ? "active" : ""}"
                                style="
                                    width:9px;
                                    height:9px;
                                    padding:0;
                                    border:0;
                                    border-radius:50%;
                                    background:${index === 0 ? "#1f4fe0" : "#c5ccda"};
                                    cursor:pointer;
                                "
                            ></button>
                        `).join("")}
                    </div>
                ` : ""}

            </div>
        `
        : `
            <div class="marketplace-gallery">
                <div class="marketplace-empty">
                    No product image available.
                </div>
            </div>
        `;

    return `
        <article class="marketplace-card">

            ${imageSection}

            <div class="marketplace-card-content">

                <h3>${safeTitle}</h3>

                <div class="marketplace-price">
                    ${safePrice}
                </div>

                <p class="marketplace-description">
                    ${safeDescription}
                </p>

                ${images.length ? `
                    <button
                        type="button"
                        class="marketplace-download"
                        data-download="${escapeHTML(images[0])}"
                        data-filename="EIS-Product-Image-1"
                    >
                        ↓ Download Image
                    </button>
                ` : ""}

                ${safeDate ? `
                    <span class="marketplace-date">
                        Posted: ${safeDate}
                    </span>
                ` : ""}

            </div>

        </article>
    `;
}

function renderProducts(products) {
    stopAllSliders();

    if (!products.length) {
        showMessage("No products found. Please check again later.");
        return;
    }

    productsContainer.innerHTML = products
        .map(createProductCard)
        .join("");

    productsContainer.querySelectorAll("[data-slider-card]").forEach(
        (card) => startSlider(card)
    );
}

function searchProducts() {
    const searchTerm = searchInput.value.trim().toLowerCase();

    const filtered = allProducts.filter((product) => {
        const title = String(product.title || "").toLowerCase();
        const description = String(product.description || "").toLowerCase();

        return title.includes(searchTerm) ||
            description.includes(searchTerm);
    });

    renderProducts(filtered);
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
        link.download = `${filename || "EIS-Product"}.jpg`;

        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(() => URL.revokeObjectURL(objectURL), 3000);

        button.textContent = "Downloaded";

    } catch (error) {
        console.error("Image download error:", error);

        button.textContent = "Opening image...";

        window.open(url, "_blank", "noopener,noreferrer");

    } finally {
        setTimeout(() => {
            button.disabled = false;
            button.textContent = originalText;
        }, 1800);
    }
}

function setupProductEvents() {
    productsContainer.addEventListener("click", (event) => {
        const next = event.target.closest("[data-slide-next]");
        const previous = event.target.closest("[data-slide-prev]");
        const dot = event.target.closest("[data-slide-dot]");
        const download = event.target.closest("[data-download]");

        if (next || previous || dot) {
            const card = event.target.closest("[data-slider-card]");
            if (!card) return;

            if (next) {
                moveSlider(card, 1);
            } else if (previous) {
                moveSlider(card, -1);
            } else if (dot) {
                setSliderImage(card, Number(dot.dataset.slideDot));
            }

            return;
        }

        if (download) {
            downloadImage(
                download.dataset.download,
                download.dataset.filename,
                download
            );
        }
    });

    productsContainer.addEventListener("mouseenter", (event) => {
        const card = event.target.closest("[data-slider-card]");
        if (card) stopSlider(card);
    }, true);

    productsContainer.addEventListener("mouseleave", (event) => {
        const card = event.target.closest("[data-slider-card]");
        if (card) startSlider(card);
    }, true);

    productsContainer.addEventListener("touchstart", (event) => {
        const card = event.target.closest("[data-slider-card]");
        if (!card) return;

        card.dataset.touchStartX = String(event.changedTouches[0].clientX);
    }, { passive: true });

    productsContainer.addEventListener("touchend", (event) => {
        const card = event.target.closest("[data-slider-card]");
        if (!card) return;

        const startX = Number(card.dataset.touchStartX || 0);
        const endX = event.changedTouches[0].clientX;
        const difference = endX - startX;

        if (Math.abs(difference) < 40) return;

        moveSlider(card, difference < 0 ? 1 : -1);
    }, { passive: true });
}

async function loadProducts() {
    showMessage("Loading products...", "loading");

    try {
        const { data, error } = await supabase
            .from("marketplace_products")
            .select("*")
            .eq("is_active", true)
            .order("created_at", { ascending: false });

        if (error) throw error;

        allProducts = data || [];

        renderProducts(allProducts);

    } catch (error) {
        console.error("Marketplace loading error:", error);

        showMessage(
            "Unable to load products: " + (error.message || "Please try again."),
            "error"
        );
    }
}

if (searchInput) {
    searchInput.addEventListener("input", searchProducts);
}

document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
        stopAllSliders();
    } else {
        productsContainer
            .querySelectorAll("[data-slider-card]")
            .forEach(startSlider);
    }
});

setupProductEvents();
loadProducts();
