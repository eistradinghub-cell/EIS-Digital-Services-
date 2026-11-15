import { supabase } from "./supabase.js";

/* =========================================
   EIS DIGITAL SERVICES
   CUSTOMER MARKETPLACE
========================================= */

const productsContainer = document.getElementById("marketplace-products");
const statusContainer = document.getElementById("marketplace-status");
const searchInput = document.getElementById("marketplace-search");
const refreshButton = document.getElementById("marketplace-reload");

let allProducts = [];


/* =========================================
   FORMAT PRICE
========================================= */

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


/* =========================================
   SHOW STATUS
========================================= */

function showStatus(message, show = true) {
    statusContainer.textContent = message;
    statusContainer.classList.toggle("show", show);
}


/* =========================================
   CREATE PRODUCT CARD
========================================= */

function createProductCard(product) {
    const card = document.createElement("article");
    card.className = "marketplace-product";

    const image = document.createElement("img");
    image.className = "marketplace-product-image";
    image.src = product.image_url || "";
    image.alt = product.title || "Marketplace product";
    image.loading = "lazy";

    image.addEventListener("error", () => {
        image.removeAttribute("src");
        image.alt = "Product image unavailable";
    });

    const content = document.createElement("div");
    content.className = "marketplace-product-content";

    const title = document.createElement("h3");
    title.textContent = product.title || "Untitled Product";

    const description = document.createElement("p");
    description.className = "marketplace-product-description";
    description.textContent =
        product.description || "No description available.";

    const price = document.createElement("p");
    price.className = "marketplace-product-price";
    price.textContent = formatPrice(product.price);

    content.append(title, description, price);
    card.append(image, content);

    return card;
}


/* =========================================
   DISPLAY PRODUCTS
========================================= */

function renderProducts(products) {
    productsContainer.replaceChildren();

    if (!products.length) {
        showStatus("No products found.", true);
        return;
    }

    showStatus("", false);

    const fragment = document.createDocumentFragment();

    products.forEach(product => {
        fragment.appendChild(createProductCard(product));
    });

    productsContainer.appendChild(fragment);
}


/* =========================================
   SEARCH PRODUCTS
========================================= */

function searchProducts() {
    const searchTerm = searchInput.value
        .trim()
        .toLowerCase();

    const filteredProducts = allProducts.filter(product => {
        const title = String(product.title || "").toLowerCase();
        const description = String(
            product.description || ""
        ).toLowerCase();

        return (
            title.includes(searchTerm) ||
            description.includes(searchTerm)
        );
    });

    renderProducts(filteredProducts);
}


/* =========================================
   LOAD PRODUCTS FROM SUPABASE
========================================= */

async function loadProducts() {
    refreshButton.disabled = true;
    refreshButton.textContent = "Loading...";

    showStatus("Loading products...", true);
    productsContainer.replaceChildren();

    try {
        const { data, error } = await supabase
            .from("marketplace_products")
            .select("*")
            .eq("is_active", true)
            .order("created_at", {
                ascending: false
            });

        if (error) {
            throw error;
        }

        allProducts = Array.isArray(data) ? data : [];

        searchProducts();

    } catch (error) {
        console.error("Marketplace loading error:", error);

        allProducts = [];

        productsContainer.replaceChildren();

        showStatus(
            "Unable to load products. Please check your internet connection and try again.",
            true
        );

    } finally {
        refreshButton.disabled = false;
        refreshButton.textContent = "Refresh Products";
    }
}


/* =========================================
   EVENT LISTENERS
========================================= */

searchInput.addEventListener("input", searchProducts);

refreshButton.addEventListener("click", loadProducts);


/* =========================================
   INITIALIZE MARKETPLACE
========================================= */

loadProducts();
