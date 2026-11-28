/* EIS Digital Services: client-side navigation for the main application pages. */
(() => {
    "use strict";

    if (window.EISSpaNavigationLoaded) return;
    window.EISSpaNavigationLoaded = true;

    const APP_ROUTES = new Set([
        "dashboard.html",
        "marketplace.html",
        "admin.html",
        "support.html"
    ]);

    let currentRoute = window.location.pathname.split("/").pop() || "dashboard.html";
    let navigationInProgress = false;
    let navigationSequence = 0;

    function resolveAppLink(href) {
        try {
            const url = new URL(href, window.location.href);
            const page = url.pathname.split("/").pop();
            if (url.origin !== window.location.origin || !APP_ROUTES.has(page)) return null;
            return { page, url };
        } catch {
            return null;
        }
    }

    function updateActiveLinks(page) {
        document.querySelectorAll("a[href]").forEach(link => {
            const route = resolveAppLink(link.href);
            if (!route) return;
            const selected = route.page === page;
            link.classList.toggle("active", selected);
            link.classList.toggle("is-active", selected);
            if (selected) link.setAttribute("aria-current", "page");
            else link.removeAttribute("aria-current");
        });
    }

    function updateDocumentHead(nextHead) {
        const nextTitle = nextHead.querySelector("title");
        if (nextTitle) document.title = nextTitle.textContent;

        document.head.querySelectorAll('meta[name="description"], meta[name="theme-color"]').forEach(node => node.remove());
        nextHead.querySelectorAll('meta[name="description"], meta[name="theme-color"]').forEach(node => {
            document.head.appendChild(node.cloneNode(true));
        });

        const nextStylesheets = [...nextHead.querySelectorAll('link[rel="stylesheet"]')]
            .map(node => new URL(node.getAttribute("href"), window.location.href).href);

        document.head.querySelectorAll('link[rel="stylesheet"]').forEach(node => {
            if (!nextStylesheets.includes(node.href) && node.dataset.keepSpa !== "true") node.remove();
        });

        nextHead.querySelectorAll('link[rel="stylesheet"]').forEach(source => {
            const href = new URL(source.getAttribute("href"), window.location.href).href;
            const exists = [...document.head.querySelectorAll('link[rel="stylesheet"]')]
                .some(node => node.href === href);
            if (!exists) {
                const stylesheet = source.cloneNode(true);
                stylesheet.href = href;
                document.head.appendChild(stylesheet);
            }
        });

        document.head.querySelectorAll("style[data-eis-page-style]").forEach(node => node.remove());
        nextHead.querySelectorAll("style").forEach(source => {
            const style = source.cloneNode(true);
            style.dataset.eisPageStyle = "true";
            document.head.appendChild(style);
        });
    }

    async function executePageScripts(nextBody, sequence) {
        const pageScripts = [...nextBody.querySelectorAll("script")];

        for (const original of pageScripts) {
            if (sequence !== navigationSequence) return;

            // The navigation controller remains installed once for the whole session.
            if (original.src && new URL(original.src, window.location.href).pathname.endsWith("/js/spa-navigation.js")) {
                continue;
            }

            const script = document.createElement("script");
            for (const attribute of original.attributes) {
                if (attribute.name === "src") {
                    const source = new URL(attribute.value, window.location.href);
                    source.searchParams.set("eis-page-load", String(sequence));
                    script.src = source.href;
                } else {
                    script.setAttribute(attribute.name, attribute.value);
                }
            }

            if (!original.src) script.textContent = original.textContent;

            if (script.type === "module") {
                await new Promise((resolve, reject) => {
                    script.onload = resolve;
                    script.onerror = () => reject(new Error("Could not initialize page module: " + (script.src || "inline module")));
                    document.body.appendChild(script);
                });
            } else {
                document.body.appendChild(script);
            }
        }
    }

    async function navigateTo(href, options = {}) {
        const route = resolveAppLink(href);
        if (!route) return false;

        if (route.page === currentRoute) {
            if (route.url.hash) {
                const target = document.getElementById(decodeURIComponent(route.url.hash.slice(1)));
                target?.scrollIntoView({ behavior: "smooth", block: "start" });
            }
            return true;
        }

        if (navigationInProgress) return true;

        navigationInProgress = true;
        const sequence = ++navigationSequence;
        const previousPage = currentRoute;

        try {
            const response = await fetch(route.url.href, {
                method: "GET",
                credentials: "same-origin",
                cache: "no-cache",
                headers: { "X-Requested-With": "EIS-Client-Navigation" }
            });

            if (!response.ok) throw new Error("Page request returned HTTP " + response.status);

            const html = await response.text();
            const nextDocument = new DOMParser().parseFromString(html, "text/html");
            if (!nextDocument.body || !nextDocument.querySelector("body")) {
                throw new Error("The requested page returned invalid HTML.");
            }

            // Keep protected routes protected when changing pages without a document reload.
            const routeGuard = await import(new URL("./route-guard.js", window.location.href).href);
            const allowed = await routeGuard.enforceProtectedRoute();
            if (!allowed) return true;
            if (sequence !== navigationSequence) return true;

            if (options.updateHistory !== false) {
                window.history.pushState({ eisClientNavigation: true }, "", route.url.href);
            }

            document.dispatchEvent(new CustomEvent("eis:before-page-change", {
                detail: { from: previousPage, to: route.page }
            }));

            updateDocumentHead(nextDocument.head);
            document.body.replaceWith(document.importNode(nextDocument.body, true));
            currentRoute = route.page;
            updateActiveLinks(currentRoute);

            if (route.url.hash) {
                const id = decodeURIComponent(route.url.hash.slice(1));
                document.getElementById(id)?.scrollIntoView();
            } else {
                window.scrollTo({ top: 0, left: 0, behavior: "instant" });
            }

            await executePageScripts(nextDocument.body, sequence);
            document.dispatchEvent(new CustomEvent("eis:page-loaded", {
                detail: { route: currentRoute }
            }));
            return true;
        } catch (error) {
            console.error("EIS client navigation failed; falling back to standard page loading.", error);
            if (options.allowFullLoad !== false) window.location.assign(route.url.href);
            return false;
        } finally {
            navigationInProgress = false;
        }
    }

    // Capture navigation clicks before page-level handlers can trigger a document load.
    window.addEventListener("click", event => {
        if (event.defaultPrevented || event.button !== 0 ||
            event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

        const element = event.target instanceof Element ? event.target : event.target?.parentElement;
        const link = element?.closest("a[href]");
        if (!link || link.target && link.target.toLowerCase() !== "_self" ||
            link.hasAttribute("download") ||
            link.getAttribute("rel")?.split(/\s+/).includes("external")) return;

        const route = resolveAppLink(link.href);
        if (!route) return;

        // Same-page hash navigation remains native; cross-page app links use SPA navigation.
        if (route.page === currentRoute) return;

        event.preventDefault();
        event.stopPropagation();
        navigateTo(route.url.href);
    }, true);

    window.addEventListener("popstate", () => {
        const route = resolveAppLink(window.location.href);
        if (route && route.page !== currentRoute) {
            navigateTo(window.location.href, { updateHistory: false });
        }
    });

    // Mark the current page's inline styles so they can be replaced on the next route.
    document.head.querySelectorAll("style").forEach(style => {
        style.dataset.eisPageStyle = "true";
    });

    window.EISNavigate = navigateTo;
    updateActiveLinks(currentRoute);
})();