/* EIS admin panels — accessible, progressive disclosure.
   Keeps existing forms, IDs and application logic intact. */
(() => {
  "use strict";

  const panels = [...document.querySelectorAll(
    ".admin-section .admin-panel:not(.admin-chat-list-panel):not(.admin-chat-window)"
  )].filter(panel => panel.querySelector(":scope > .admin-panel-header"));

  panels.forEach((panel, index) => {
    const heading = panel.querySelector(":scope > .admin-panel-header");
    if (!heading || panel.dataset.disclosureReady === "true") return;

    const section = panel.closest(".admin-section");
    const sectionKey = section?.id || "admin";
    const panelKey = heading.querySelector("h3")?.textContent.trim()
      .toLowerCase().replace(/[^a-z0-9]+/g, "-") || String(index);
    const storageKey = `eis-admin-panel:${sectionKey}:${panelKey}`;

    const body = document.createElement("div");
    body.className = "admin-panel-content";
    body.id = `admin-panel-content-${index}`;

    while (heading.nextSibling) body.append(heading.nextSibling);
    panel.append(body);

    heading.classList.add("admin-panel-toggle");
    heading.setAttribute("role", "button");
    heading.setAttribute("tabindex", "0");
    heading.setAttribute("aria-controls", body.id);

    let expanded = false;
    try { expanded = localStorage.getItem(storageKey) === "open"; } catch (_) {}
    const setExpanded = (value, persist = true) => {
      expanded = value;
      panel.classList.toggle("is-expanded", expanded);
      heading.setAttribute("aria-expanded", String(expanded));
      body.hidden = !expanded;
      if (persist) {
        try { localStorage.setItem(storageKey, expanded ? "open" : "closed"); } catch (_) {}
      }
    };

    heading.addEventListener("click", event => {
      if (event.target.closest("a, button, input, select, textarea, label")) return;
      setExpanded(!expanded);
    });
    heading.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setExpanded(!expanded);
      }
    });

    setExpanded(expanded, false);
    panel.dataset.disclosureReady = "true";
  });
})();
