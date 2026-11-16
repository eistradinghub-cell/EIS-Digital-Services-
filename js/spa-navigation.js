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
        const parsed = new URL(url, window.location.href);
        const file = parsed.pathname.split("/").pop();

        if (!ROUTES.includes(file)) return null;

        return {
            file,
            url: parsed
        };
    }

    function isInternalNavigation(link) {
        if (!link || !link.href) return false;
        if (link.target && link.target !== "_self") return false;
        if (link.hasAttribute("download")) return false;

        const route = getRoute(link.href);
        if (!route) return false;

        const destination = new URL(link.href);
        if (destination.origin !== window.location.origin) return false;

        return true;
    }

    function updateActiveNavigation(route) {
        document.querySelectorAll(
            'a[href*="dashboard.html"], a[href*="marketplace.html"], a[href*="admin.html"]'
        ).forEach(link => {
            const destination = getRoute(link.href);
            const active = destination?.file === route;

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
        const currentLinks = Array.from(
            document.head.querySelectorAll('link[rel="stylesheet"]')
        );

        const nextLinks = Array.from(
            parsedDocument.head.querySelectorAll('link[rel="stylesheet"]')
        );

        const nextHrefs = nextLinks.map(link =>
            new URL(link.getAttribute("href"), window.location.href).href
        );

        currentLinks.forEach(link => {
            const href = link.href;

            if (
                href &&
                !nextHrefs.includes(href) &&
                !link.dataset.keepSpa
            ) {
                link.remove();
            }
        });

        nextLinks.forEach(source => {
            const href = new URL(
                source.getAttribute("href"),
                window.location.href
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
                        window.location.href
                    );

                    source.searchParams.set(
                        "spa-navigation",
                        String(++navigationNumber)
                    );

                    script.src = source.href;
                } else {
                    script.setAttribute(
                        attribute.name,
                        attribute.value
                    );
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

        if (route.url.href === window.location.href) return;

        navigating = true;

        try {
            const response = await fetch(route.url.href, {
                method: "GET",
                credentials: "same-origin",
                headers: {
                    "X-Requested-With": "EIS-SPA-Navigation"
                }
            });

            if (!response.ok) {
                throw new Error(
                    `Page request failed: ${response.status}`
                );
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

            window.scrollTo({
                top: 0,
                behavior: "instant"
            });

            await executePageScripts(parsedDocument);

            document.dispatchEvent(
                new CustomEvent("eis:page-loaded", {
                    detail: {
                        route: route.file
                    }
                })
            );

        } catch (error) {
            console.error("EIS SPA navigation error:", error);

            if (options.fallback !== false) {
                window.location.href = route.url.href;
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
        ) {
            return;
        }

        const link = event.target.closest("a");

        if (!isInternalNavigation(link)) return;

        event.preventDefault();
        navigate(link.href);
    });

    window.addEventListener("popstate", () => {
        const route = getRoute(window.location.href);

        if (route) {
            navigate(window.location.href, {
                history: false,
                fallback: true
            });
        }
    });

    updateActiveNavigation(
        window.location.pathname.split("/").pop()
    );

    console.info("EIS SPA Navigation initialized.");
})();
