import { supabase } from "./supabase.js";

const productsContainer = document.getElementById("marketplace-products");
const searchInput = document.getElementById("marketplace-search");

const WHATSAPP_NUMBER = "2347044034497";

let allProducts = [];
const sliderTimers = new Map();
const visibleSliderCards = new Set();
let sliderVisibilityObserver = null;

let lightboxImages = [];
let lightboxIndex = 0;
let lightboxOpen = false;

/* ADMIN NAVIGATION: SHOW ONLY TO VERIFIED ADMIN USERS */
async function initializeAdminNavigation() {
    const adminButton = document.getElementById("nav-admin");

    if (!adminButton) return;

    adminButton.hidden = true;
    adminButton.classList.remove("is-admin-nav");

    try {
        const {
            data: { user },
            error: authError
        } = await supabase.auth.getUser();

        if (authError) throw authError;
        if (!user) return;

        const { data, error } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .maybeSingle();

        if (error) throw error;

        const role = String(data?.role || "").trim().toLowerCase();

        if (["admin", "super_admin"].includes(role)) {
            adminButton.hidden = false;
            adminButton.classList.add("is-admin-nav");
        }
    } catch (error) {
        console.error("Admin navigation check failed:", error);
        adminButton.hidden = true;
        adminButton.classList.remove("is-admin-nav");
    }
}

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

function stopAllSliders() {
    sliderTimers.forEach((timer) => clearInterval(timer));
    sliderTimers.clear();
}

function showMessage(message, type = "empty") {
    stopAllSliders();

    if (sliderVisibilityObserver) {
        sliderVisibilityObserver.disconnect();
        sliderVisibilityObserver = null;
    }
    visibleSliderCards.clear();

    productsContainer.innerHTML = `
        <div class="marketplace-${type}">
            ${escapeHTML(message)}
        </div>
    `;
}

function setSliderImage(card, index) {
    const images = JSON.parse(card.dataset.images || "[]");

    if (!images.length) return;

    const safeIndex = (index + images.length) % images.length;

    card.dataset.currentIndex = String(safeIndex);

    const mainImage = card.querySelector("[data-main-image]");
    const counter = card.querySelector("[data-image-counter]");
    const dots = card.querySelectorAll("[data-slide-dot]");

    if (mainImage) {
        mainImage.style.opacity = "0.4";
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
}

function moveSlider(card, direction) {
    const current = Number(card.dataset.currentIndex || 0);
    setSliderImage(card, current + direction);
}

function startSlider(card) {
    if (sliderVisibilityObserver && !visibleSliderCards.has(card)) return;

    const images = JSON.parse(card.dataset.images || "[]");

    if (images.length < 2) return;

    stopSlider(card);

    const timer = setInterval(() => {
        if (
            document.hidden ||
            card.matches(":hover") ||
            card.contains(document.activeElement) ||
            lightboxOpen
        ) {
            return;
        }

        moveSlider(card, 1);
    }, 4000);

    sliderTimers.set(card, timer);
}

function stopSlider(card) {
    const timer = sliderTimers.get(card);

    if (timer) {
        clearInterval(timer);
        sliderTimers.delete(card);
    }
}

/* WHATSAPP ORDER */

function createWhatsAppLink(product) {
    const message = [
        "Hello EIS Digital Services,",
        "",
        "I am interested in ordering this product:",
        `Product: ${product.title || "Product"}`,
        `Price: ${formatPrice(product.price)}`,
        "",
        "Please provide more information about availability and ordering."
    ].join("\n");

    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

/* FULL SCREEN IMAGE VIEWER */

function createLightbox() {
    if (document.getElementById("marketplace-lightbox")) return;

    const lightbox = document.createElement("div");

    lightbox.id = "marketplace-lightbox";
    lightbox.className = "marketplace-lightbox";

    lightbox.innerHTML = `
        <button
            type="button"
            class="lightbox-close"
            aria-label="Close image"
        >×</button>

        <button
            type="button"
            class="lightbox-prev"
            aria-label="Previous image"
        >‹</button>

        <img
            class="lightbox-image"
            src=""
            alt="Product full view"
        >

        <button
            type="button"
            class="lightbox-next"
            aria-label="Next image"
        >›</button>

        <div class="lightbox-counter"></div>
    `;

    document.body.appendChild(lightbox);

    lightbox.addEventListener("click", (event) => {
        if (
            event.target === lightbox ||
            event.target.closest(".lightbox-close")
        ) {
            closeLightbox();
        }

        if (event.target.closest(".lightbox-prev")) {
            changeLightboxImage(-1);
        }

        if (event.target.closest(".lightbox-next")) {
            changeLightboxImage(1);
        }
    });

    document.addEventListener("keydown", (event) => {
        if (!lightboxOpen) return;

        if (event.key === "Escape") {
            closeLightbox();
        }

        if (event.key === "ArrowRight") {
            changeLightboxImage(1);
        }

        if (event.key === "ArrowLeft") {
            changeLightboxImage(-1);
        }
    });

    let touchStartX = 0;

    lightbox.addEventListener("touchstart", (event) => {
        touchStartX = event.changedTouches[0].clientX;
    }, { passive: true });

    lightbox.addEventListener("touchend", (event) => {
        const difference =
            event.changedTouches[0].clientX - touchStartX;

        if (Math.abs(difference) < 50) return;

        changeLightboxImage(difference < 0 ? 1 : -1);
    }, { passive: true });
}

function openLightbox(images, index = 0) {
    if (!images.length) return;

    createLightbox();

    lightboxImages = images;
    lightboxIndex = index;
    lightboxOpen = true;

    const lightbox = document.getElementById("marketplace-lightbox");

    lightbox.classList.add("active");
    document.body.classList.add("lightbox-active");

    if (!history.state || !history.state.marketplaceLightbox) {
        history.pushState(
            { marketplaceLightbox: true },
            "",
            window.location.href
        );
    }

    updateLightbox();
}

function updateLightbox() {
    const lightbox = document.getElementById("marketplace-lightbox");

    if (!lightbox) return;

    const image = lightbox.querySelector(".lightbox-image");
    const counter = lightbox.querySelector(".lightbox-counter");

    image.src = lightboxImages[lightboxIndex];

    counter.textContent =
        `${lightboxIndex + 1} / ${lightboxImages.length}`;

    const previous = lightbox.querySelector(".lightbox-prev");
    const next = lightbox.querySelector(".lightbox-next");

    previous.style.display =
        lightboxImages.length > 1 ? "flex" : "none";

    next.style.display =
        lightboxImages.length > 1 ? "flex" : "none";
}

function changeLightboxImage(direction) {
    if (lightboxImages.length < 2) return;

    lightboxIndex =
        (lightboxIndex + direction + lightboxImages.length) %
        lightboxImages.length;

    updateLightbox();
}

function closeLightbox(fromHistory = false) {
    if (!lightboxOpen) return;

    lightboxOpen = false;

    const lightbox = document.getElementById("marketplace-lightbox");

    if (lightbox) {
        lightbox.classList.remove("active");
    }

    document.body.classList.remove("lightbox-active");

    if (!fromHistory && history.state?.marketplaceLightbox) {
        history.back();
    }
}

window.addEventListener("popstate", () => {
    if (lightboxOpen) {
        closeLightbox(true);
    }
});

/* PRODUCT CARD */

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
            >

                <img
                    class="marketplace-main-image"
                    data-main-image
                    src="${escapeHTML(images[0])}"
                    alt="${safeTitle}"
                    loading="lazy"
                    title="Tap to view full image"
                >

                <span
                    class="marketplace-zoom-hint"
                >Tap image to enlarge</span>

                ${images.length > 1 ? `
                    <span
                        class="marketplace-image-count"
                        data-image-counter
                    >1 / ${images.length}</span>

                    <button
                        type="button"
                        class="marketplace-slide-button slide-prev"
                        data-slide-prev
                        aria-label="Previous image"
                    >‹</button>

                    <button
                        type="button"
                        class="marketplace-slide-button slide-next"
                        data-slide-next
                        aria-label="Next image"
                    >›</button>

                    <div class="marketplace-slider-dots">
                        ${images.map((image, index) => `
                            <button
                                type="button"
                                data-slide-dot="${index}"
                                aria-label="Show image ${index + 1}"
                                class="${index === 0 ? "active" : ""}"
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

    const whatsappLink = createWhatsAppLink(product);

    return `
        <article class="marketplace-card">

            ${imageSection}

            <div class="marketplace-card-content">

                <h3 class="marketplace-product-title">
                    ${safeTitle}
                </h3>

                <div class="marketplace-price">
                    ${safePrice}
                </div>

                <p class="marketplace-description">
                    ${safeDescription}
                </p>

                <a
                    class="marketplace-order"
                    href="${escapeHTML(whatsappLink)}"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    <span>Order on WhatsApp</span>
                    <span class="whatsapp-arrow">→</span>
                </a>

                ${safeDate ? `
                    <span class="marketplace-date">
                        Posted: ${safeDate}
                    </span>
                ` : ""}

            </div>

        </article>
    `;
}

/* RENDER PRODUCTS */

function observeVisibleSliders() {
    if (sliderVisibilityObserver) {
        sliderVisibilityObserver.disconnect();
        sliderVisibilityObserver = null;
    }

    visibleSliderCards.clear();

    const cards = productsContainer.querySelectorAll("[data-slider-card]");
    if (!cards.length) return;

    // Older browsers still get working sliders, while modern browsers
    // only animate product cards that are close to the visible screen.
    if (!("IntersectionObserver" in window)) {
        cards.forEach(startSlider);
        return;
    }

    sliderVisibilityObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            const card = entry.target;

            if (entry.isIntersecting) {
                visibleSliderCards.add(card);
                if (!document.hidden && !lightboxOpen) startSlider(card);
            } else {
                visibleSliderCards.delete(card);
                stopSlider(card);
            }
        });
    }, {
        root: null,
        rootMargin: "120px 0px",
        threshold: 0.01
    });

    cards.forEach((card) => sliderVisibilityObserver.observe(card));
}

function renderProducts(products) {
    stopAllSliders();

    if (sliderVisibilityObserver) {
        sliderVisibilityObserver.disconnect();
        sliderVisibilityObserver = null;
    }
    visibleSliderCards.clear();

    if (!products.length) {
        showMessage("No products found. Please check again later.");
        return;
    }

    productsContainer.innerHTML = products
        .map(createProductCard)
        .join("");

    observeVisibleSliders();
}

/* SEARCH */

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

/* EVENTS */

function setupProductEvents() {
    productsContainer.addEventListener("click", (event) => {
        const next = event.target.closest("[data-slide-next]");
        const previous = event.target.closest("[data-slide-prev]");
        const dot = event.target.closest("[data-slide-dot]");
        const mainImage = event.target.closest("[data-main-image]");

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

        if (mainImage) {
            const card = mainImage.closest("[data-slider-card]");

            if (!card) return;

            const images = JSON.parse(card.dataset.images || "[]");
            const currentIndex = Number(card.dataset.currentIndex || 0);

            openLightbox(images, currentIndex);
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

        card.dataset.touchStartX =
            String(event.changedTouches[0].clientX);
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

/* LOAD PRODUCTS */

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
            "Unable to load products: " +
            (error.message || "Please try again."),
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
    } else if (!lightboxOpen) {
        visibleSliderCards.forEach(startSlider);

        // Fallback for browsers without IntersectionObserver.
        if (!sliderVisibilityObserver) {
            productsContainer
                .querySelectorAll("[data-slider-card]")
                .forEach(startSlider);
        }
    }
});

initializeAdminNavigation();
setupProductEvents();
loadProducts();
