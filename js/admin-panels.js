/* EIS Site Settings — accessible section disclosure.
   Only the settings panels are affected. Existing forms and handlers stay intact. */
(() => {
  "use strict";

  const settings = document.querySelector("#section-site-settings");
  if (!settings) return;

  const panels = [...settings.querySelectorAll(":scope > .admin-panel")];

  panels.forEach((panel, index) => {
    const heading = panel.querySelector(":scope > .admin-panel-header");
    if (!heading || panel.dataset.disclosureReady === "true") return;

    const body = document.createElement("div");
    body.className = "admin-panel-content";
    body.id = `site-settings-panel-content-${index + 1}`;

    while (heading.nextSibling) body.append(heading.nextSibling);
    panel.append(body);

    heading.classList.add("admin-panel-toggle");
    heading.setAttribute("role", "button");
    heading.setAttribute("tabindex", "0");
    heading.setAttribute("aria-controls", body.id);

    const setExpanded = expanded => {
      panel.classList.toggle("is-expanded", expanded);
      heading.setAttribute("aria-expanded", String(expanded));
      body.hidden = !expanded;
    };

    heading.addEventListener("click", event => {
      if (event.target.closest("a, button, input, select, textarea, label")) return;
      setExpanded(heading.getAttribute("aria-expanded") !== "true");
    });

    heading.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setExpanded(heading.getAttribute("aria-expanded") !== "true");
      }
    });

    setExpanded(false);
    panel.dataset.disclosureReady = "true";
  });
})();
