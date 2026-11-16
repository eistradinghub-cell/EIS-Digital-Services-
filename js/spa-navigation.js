/* EIS DIGITAL SERVICES - SPA NAVIGATION */

(() => {
    "use strict";

    if (window.EISSpaNavigationLoaded) return;
    window.EISSpaNavigationLoaded = true;

    const ROUTES = [
        "dashboard.html",
        "marketplace.html",
        "admin.html"
    ];

    let navigationNumber = 0;
    let navigating = false;

    function getRoute(url) {
        const parsed = new URL(url, location.href);
        const file = parsed.pathname.split("/").pop();

        if (!ROUTES.includes(file)) return null;

        return { file, url: parsed };
    }

    function updateActiveNavigation(route) {
        document.querySelectorAll("a[href]").forEach(link => {
            const destination = getRoute(link.href);
            if (!destination) return;

            const active = destination.file === route;

            link.classList.toggle("active", active);
            link.classList.toggle("is-active", active);

            if (active) {
                link.setAttribute("aria-current", "page");
            } else {
                link.removeAttribute("aria-current");
            }
        });
    }

    function updateStylesheets(parsedDocument) {
        const current = Array.from(
            document.head.querySelectorAll('link[rel="stylesheet"]')
        );

        const next = Array.from(
            parsedDocument.head.querySelectorAll('link[rel="stylesheet"]')
        );

        const nextHrefs = next.map(link =>
            new URL(link.getAttribute("href"), location.href).href
        );

        current.forEach(link => {
            if (
                !nextHrefs.includes(link.href) &&
                !link.dataset.keepSpa
            ) {
                link.remove();
            }
        });

        next.forEach(source => {
            const href = new URL(
                source.getAttribute("href"),
                location.href
            ).href;

            const exists = Array.from(
                document.head.querySelectorAll('link[rel="stylesheet"]')
            ).some(link => link.href === href);

            if (!exists) {
                const link = document.createElement("link");
                link.rel = "stylesheet";
                link.href = href;
                document.head.appendChild(link);
            }
        });
    }

    async function executePageScripts(parsedDocument) {
        const scripts = Array.from(
            parsedDocument.body.querySelectorAll("script")
        );

        for (const oldScript of scripts) {
            const script = document.createElement("script");

            for (const attribute of oldScript.attributes) {
                if (attribute.name === "src") {
                    const source = new URL(
                        attribute.value,
                        location.href
                    );

                    source.searchParams.set(
                        "spa-navigation",
                        String(++navigationNumber)
                    );

                    script.src = source.href;
                } else {
                    script.setAttribute(attribute.name, attribute.value);
                }
            }

            if (!oldScript.src) {
                script.textContent = oldScript.textContent;
            }

            if (script.type === "module" && script.src) {
                await new Promise(resolve => {
                    script.onload = resolve;
                    script.onerror = resolve;
                    document.body.appendChild(script);
                });
            } else {
                document.body.appendChild(script);
            }
        }
    }

    async function navigate(url, options = {}) {
        const route = getRoute(url);
        if (!route || navigating) return;

        if (
            options.history !== false &&
            route.url.href === location.href
        ) {
            return;
        }

        navigating = true;

        try {
            const response = await fetch(route.url.href, {
                credentials: "same-origin",
                headers: {
                    "X-Requested-With": "EIS-SPA-Navigation"
                }
            });

            if (!response.ok) {
                throw new Error(`Page request failed: ${response.status}`);
            }

            const html = await response.text();

            const parsedDocument = new DOMParser().parseFromString(
                html,
                "text/html"
            );

            if (!parsedDocument.body) {
                throw new Error("Invalid page response.");
            }

            if (options.history !== false) {
                history.pushState(
                    { eisSpa: true },
                    "",
                    route.url.href
                );
            }

            updateStylesheets(parsedDocument);

            document.title =
                parsedDocument.title || "EIS Digital Services";

            document.body.replaceWith(
                document.importNode(parsedDocument.body, true)
            );

            updateActiveNavigation(route.file);

            window.scrollTo(0, 0);

            await executePageScripts(parsedDocument);

            document.dispatchEvent(
                new CustomEvent("eis:page-loaded", {
                    detail: { route: route.file }
                })
            );

        } catch (error) {
            console.error("EIS SPA navigation error:", error);

            if (options.fallback !== false) {
                location.href = route.url.href;
            }
        } finally {
            navigating = false;
        }
    }

    document.addEventListener("click", event => {
        if (
            event.defaultPrevented ||
            event.button !== 0 ||
            event.ctrlKey ||
            event.metaKey ||
            event.shiftKey ||
            event.altKey
        ) return;

        const link = event.target.closest("a");

        if (!link || !link.href) return;
        if (link.target && link.target !== "_self") return;
        if (link.hasAttribute("download")) return;

        const route = getRoute(link.href);
        if (!route) return;

        if (new URL(link.href).origin !== location.origin) return;

        event.preventDefault();
        navigate(link.href);
    });

    window.addEventListener("popstate", () => {
        if (getRoute(location.href)) {
            navigate(location.href, {
                history: false,
                fallback: true
            });
        }
    });

    updateActiveNavigation(
        location.pathname.split("/").pop()
    );

    console.info("EIS SPA Navigation initialized.");
})();
