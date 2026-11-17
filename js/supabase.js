import { createClient } from
'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

/* =========================================
   EIS DIGITAL SERVICES
   SUPABASE CONFIGURATION
========================================= */

const SUPABASE_URL =
'https://mbihyrbfeatcynspzune.supabase.co';

const SUPABASE_ANON_KEY =
'sb_publishable_alh5WL2JbOK6yW_5z5Fq4A_kJQHWt1-';


/* =========================================
   INITIALIZE SUPABASE
========================================= */

export const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true,
            flowType: 'pkce',
            storage: window.localStorage,
            storageKey: 'eis-digital-services-auth'
        },

        global: {
            headers: {
                'X-Client-Info': 'eis-digital-services-web'
            }
        }
    }
);


/* =========================================
   GET CURRENT SESSION
========================================= */

export async function getCurrentSession() {

    const { data, error } =
        await supabase.auth.getSession();

    if (error) {
        console.error('Session Error:', error);
        return null;
    }

    return data.session;
}


/* =========================================
   GET CURRENT USER
========================================= */

export async function getCurrentUser() {

    const { data, error } =
        await supabase.auth.getUser();

    if (error) {
        console.error('User Error:', error);
        return null;
    }

    return data.user;
}


/* =========================================
   CHECK AUTHENTICATION
========================================= */

export async function isAuthenticated() {

    const session = await getCurrentSession();

    return Boolean(session);
}


/* =========================================
   LOGOUT
========================================= */

export async function logoutUser() {

    const { error } =
        await supabase.auth.signOut();

    if (error) {
        console.error('Logout Error:', error);
        throw error;
    }

    window.location.replace('./index.html');
}


/* =========================================
   AUTH STATE LISTENER
========================================= */

export function onAuthStateChange(callback) {

    const {
        data: { subscription }
    } = supabase.auth.onAuthStateChange(
        (event, session) => {

            if (typeof callback === 'function') {
                callback(event, session);
            }

        }
    );

    return subscription;
}


/* =========================================
   DEFAULT EXPORT
========================================= */

export default supabase;


/* =========================================
   PUBLIC SITE SETTINGS DISPLAY
   Applies settings saved by the admin across
   customer-facing and administrator pages.
========================================= */

function normalizeSettingValue(value) {
    if (typeof value === "string") {
        try {
            return JSON.parse(value);
        } catch {
            return value;
        }
    }

    return value && typeof value === "object" ? value : {};
}


function getSettingImageUrl(value) {
    if (typeof value === "string") return value;

    if (!value || typeof value !== "object") return "";

    return value.url ||
        value.publicUrl ||
        value.public_url ||
        "";
}


function getSettingInitials(value) {
    return String(value || "EIS Support")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(part => part.charAt(0).toUpperCase())
        .join("") || "EIS";
}


/* =========================================
   SETTINGS DISPLAY STYLES
========================================= */

function addSettingsStyles() {

    if (document.getElementById("eis-public-settings-styles")) {
        return;
    }

    const style = document.createElement("style");

    style.id = "eis-public-settings-styles";

    style.textContent = [

        ".eis-settings-home-gallery{width:100%;max-width:1180px;margin:24px auto 0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:15px}",

        ".eis-settings-home-card{min-width:0;overflow:hidden;border:1px solid #dce7f8;border-radius:15px;background:#fff;box-shadow:0 7px 22px rgba(20,55,105,.07)}",

        ".eis-settings-home-card img{display:block;width:100%;height:190px;object-fit:cover}",

        ".eis-settings-message-meta{display:flex;align-items:center;gap:7px;margin:0 0 7px;color:#526783;font-size:10px;line-height:1.2}",

        ".eis-settings-message-meta img,.eis-settings-message-avatar{display:inline-flex;align-items:center;justify-content:center;width:23px;height:23px;flex:0 0 23px;border-radius:50%;object-fit:cover;background:#e8efff;color:#2456c5;font-size:8px;font-weight:800}",

        ".eis-settings-message-meta strong{color:#34445e;font-size:10px;font-weight:800}",

        ".support-avatar img,#admin-avatar img{display:block;width:100%;height:100%;border-radius:inherit;object-fit:cover}",

        "@media(max-width:700px){.eis-settings-home-gallery{grid-template-columns:1fr;gap:11px;margin-top:17px}.eis-settings-home-card img{height:185px}}"

    ].join("\n");

    document.head.appendChild(style);
}


/* =========================================
   APPLY WEBSITE LOGO
========================================= */

function applySiteLogo(logoUrl) {

    if (!logoUrl) return;

    const targets = document.querySelectorAll(
        "svg.brand-mark,img.brand-mark,svg.admin-brand-logo,img.admin-brand-logo,.logo-icon,.global-admin-brand > span:first-child"
    );

    targets.forEach(element => {

        if (element.tagName.toLowerCase() === "img") {

            element.src = logoUrl;
            element.alt = "EIS Digital Services";

            return;
        }

        const rect = element.getBoundingClientRect();

        const computed = window.getComputedStyle(element);

        let width =
            rect.width ||
            parseFloat(computed.width) ||
            42;

        let height =
            rect.height ||
            parseFloat(computed.height) ||
            42;

        if (element.classList.contains("logo-icon")) {
            width = 34;
            height = 34;
        }

        if (
            element.parentElement?.classList.contains(
                "global-admin-brand"
            )
        ) {
            width = 36;
            height = 36;
        }

        const image = document.createElement("img");

        image.src = logoUrl;
        image.alt = "EIS Digital Services";

        image.className =
            element.getAttribute("class") || "";

        image.style.width = width + "px";
        image.style.height = height + "px";
        image.style.maxWidth = "100%";
        image.style.objectFit = "contain";
        image.style.display = "block";

        element.replaceWith(image);

    });
}


/* =========================================
   DISPLAY HOMEPAGE IMAGES
========================================= */

function renderHomepageImages(homeImages) {

    const slots = [
        {
            key: "image1",
            label: "Homepage Image 1"
        },
        {
            key: "image2",
            label: "Homepage Image 2"
        },
        {
            key: "image3",
            label: "Homepage Image 3"
        }
    ];

    const images = slots
        .map(slot => ({
            label: slot.label,
            url: getSettingImageUrl(
                homeImages?.[slot.key]
            )
        }))
        .filter(item => item.url);

    const destinations = [

        document.querySelector(
            "#view-home .hero-grid"
        ),

        document.querySelector(
            ".dashboard-intro"
        )

    ].filter(Boolean);


    destinations.forEach(target => {

        const existing =
            target.parentElement?.querySelector(
                ":scope > .eis-settings-home-gallery"
            );

        if (existing) existing.remove();

        if (!images.length) return;


        const gallery = document.createElement("section");

        gallery.className =
            "eis-settings-home-gallery";

        gallery.setAttribute(
            "aria-label",
            "Homepage images"
        );


        images.forEach(item => {

            const card = document.createElement("article");

            card.className =
                "eis-settings-home-card";


            const image = document.createElement("img");

            image.src = item.url;
            image.alt = item.label;
            image.loading = "lazy";


            // Show the image only. No caption or label is displayed underneath.
            card.appendChild(image);

            gallery.appendChild(card);

        });


        target.insertAdjacentElement(
            "afterend",
            gallery
        );

    });
}


/* =========================================
   ADMIN MESSAGE IDENTITY
========================================= */

function createAdminMessageMeta(name, avatarUrl) {

    const meta = document.createElement("div");

    meta.className =
        "eis-settings-message-meta";


    if (avatarUrl) {

        const avatar = document.createElement("img");

        avatar.src = avatarUrl;
        avatar.alt = "";
        avatar.loading = "lazy";

        meta.appendChild(avatar);

    } else {

        const avatar = document.createElement("span");

        avatar.className =
            "eis-settings-message-avatar";

        avatar.textContent =
            getSettingInitials(name);

        meta.appendChild(avatar);

    }


    const label = document.createElement("strong");

    label.textContent = name;

    meta.appendChild(label);

    return meta;
}


/* =========================================
   APPLY ADMIN IDENTITY TO CHAT MESSAGES
========================================= */

function observeAdminMessages(settings) {

    const name =
        settings.displayName || "EIS Support";

    const avatarUrl =
        getSettingImageUrl(settings.avatar);


    const customerChat =
        document.getElementById("chat-messages");

    const adminChat =
        document.getElementById("admin-chat-messages");


    const decorate = (container, selector) => {

        if (!container) return;


        const apply = () => {

            container.querySelectorAll(selector).forEach(bubble => {

                if (
                    bubble.querySelector(
                        ":scope > .eis-settings-message-meta"
                    )
                ) {
                    return;
                }


                bubble.insertBefore(
                    createAdminMessageMeta(
                        name,
                        avatarUrl
                    ),
                    bubble.firstChild
                );

            });

        };


        apply();


        const observer = new MutationObserver(apply);

        observer.observe(container, {
            childList: true
        });

    };


    // Incoming messages on customer support page.
    decorate(
        customerChat,
        ".msg-theirs"
    );


    // Admin replies in administrator inbox.
    decorate(
        adminChat,
        ".chat-message.admin"
    );

}


/* =========================================
   APPLY ADMIN PROFILE
========================================= */

function applyAdminProfile(settings) {

    const name =
        String(settings.displayName || "").trim();

    const avatarUrl =
        getSettingImageUrl(settings.avatar);


    const supportAvatar =
        document.querySelector(".support-avatar");

    const supportTitle =
        document.querySelector(".chat-header h3");


    if (supportTitle && name) {
        supportTitle.textContent = name;
    }


    if (supportAvatar && avatarUrl) {

        const image = document.createElement("img");

        image.src = avatarUrl;
        image.alt = name || "EIS Support";
        image.loading = "lazy";

        supportAvatar.replaceChildren(image);

        supportAvatar.setAttribute(
            "aria-label",
            name || "EIS Support"
        );

    }


    const sidebarName =
        document.getElementById("sidebar-admin-name");

    const sidebarAvatar =
        document.getElementById("admin-avatar");


    const updateAdminIdentity = () => {

        if (
            sidebarName &&
            name &&
            sidebarName.textContent !== name
        ) {
            sidebarName.textContent = name;
        }


        if (sidebarAvatar && avatarUrl) {

            const currentImage =
                sidebarAvatar.querySelector("img");

            if (
                !currentImage ||
                currentImage.src !== avatarUrl
            ) {

                const image = document.createElement("img");

                image.src = avatarUrl;
                image.alt = name || "Administrator";
                image.loading = "lazy";

                sidebarAvatar.replaceChildren(image);

            }

        }

    };


    updateAdminIdentity();


    if (sidebarName || sidebarAvatar) {

        const identityObserver =
            new MutationObserver(updateAdminIdentity);


        if (sidebarName) {

            identityObserver.observe(sidebarName, {
                childList: true,
                characterData: true,
                subtree: true
            });

        }


        if (sidebarAvatar) {

            identityObserver.observe(sidebarAvatar, {
                childList: true,
                characterData: true,
                subtree: true
            });

        }

    }


    observeAdminMessages(settings);

}


/* =========================================
   LOAD SAVED SITE SETTINGS
========================================= */

async function applySavedSiteSettings() {

    if (typeof document === "undefined") return;


    try {

        const { data, error } = await supabase
            .from("site_settings")
            .select("setting_key,setting_value")
            .in(
                "setting_key",
                [
                    "site_logo",
                    "home_images",
                    "admin_profile"
                ]
            );


        if (error) throw error;


        const settings = {

            site_logo: {},

            home_images: {},

            admin_profile: {}

        };


        (data || []).forEach(row => {

            settings[row.setting_key] =
                normalizeSettingValue(
                    row.setting_value
                );

        });


        window.EISSiteSettings = settings;


        addSettingsStyles();


        applySiteLogo(
            getSettingImageUrl(settings.site_logo)
        );


        renderHomepageImages(
            settings.home_images
        );


        applyAdminProfile(
            settings.admin_profile
        );


        console.log(
            "EIS saved site settings applied."
        );


    } catch (error) {

        // Settings errors must never interrupt
        // login or page initialization.

        console.warn(
            "EIS site settings could not be applied:",
            error
        );

    }

}


/* =========================================
   AUTOMATIC SITE SETTINGS INITIALIZATION
========================================= */

if (typeof document !== "undefined") {

    if (document.readyState === "loading") {

        document.addEventListener(
            "DOMContentLoaded",
            applySavedSiteSettings,
            { once: true }
        );

    } else {

        applySavedSiteSettings();

    }

           }


/* =========================================
   ADMIN HOMEPAGE IMAGE REMOVE CONTROLS
   Allows an authorized administrator to
   remove each saved homepage image slot.
========================================= */

const EIS_HOME_IMAGE_PREVIEWS = {
    "site-home-image-one-preview": {
        key: "image1",
        inputId: "site-home-image-one",
        label: "Homepage Image 1",
        folder: "homepage-image-1"
    },
    "site-home-image-two-preview": {
        key: "image2",
        inputId: "site-home-image-two",
        label: "Homepage Image 2",
        folder: "homepage-image-2"
    },
    "site-home-image-three-preview": {
        key: "image3",
        inputId: "site-home-image-three",
        label: "Homepage Image 3",
        folder: "homepage-image-3"
    }
};

function addHomepageImageRemoveStyles() {
    if (document.getElementById("eis-home-image-remove-styles")) return;

    const style = document.createElement("style");
    style.id = "eis-home-image-remove-styles";
    style.textContent = [
        "#section-site-settings .site-settings-image-preview{position:relative}",
        "#section-site-settings .eis-home-image-remove{position:absolute;top:8px;right:8px;z-index:5;display:inline-flex;align-items:center;justify-content:center;min-height:32px;padding:7px 12px;border:1px solid rgba(255,255,255,.35);border-radius:9px;background:#dc3545;color:#fff;font:800 11px/1.2 Arial,sans-serif;box-shadow:0 4px 13px rgba(120,20,35,.2);cursor:pointer}",
        "#section-site-settings .eis-home-image-remove:hover{background:#b92333}",
        "#section-site-settings .eis-home-image-remove:disabled{opacity:.65;cursor:wait}"
    ].join("\n");
    document.head.appendChild(style);
}

function addHomepageImageRemoveButtons() {
    if (!document.getElementById("section-site-settings")) return;

    Object.entries(EIS_HOME_IMAGE_PREVIEWS).forEach(([previewId, config]) => {
        const preview = document.getElementById(previewId);
        if (!preview) return;

        const image = preview.querySelector("img");
        const existingButton = preview.querySelector(
            "[data-eis-remove-home-image]"
        );

        if (!image) {
            if (existingButton) existingButton.remove();
            return;
        }

        if (existingButton) return;

        const button = document.createElement("button");
        button.type = "button";
        button.className = "eis-home-image-remove";
        button.textContent = "Remove Image";
        button.setAttribute("aria-label", "Remove " + config.label);
        button.dataset.eisRemoveHomeImage = config.key;

        preview.appendChild(button);
    });
}

function showHomepageImageRemoveFeedback(message, type = "success") {
    const box = document.getElementById("site-settings-feedback");

    if (!box) {
        console[type === "error" ? "error" : "log"](message);
        return;
    }

    box.textContent = message;
    box.className = "site-settings-feedback" +
        (type === "error" ? " error" : "");
    box.hidden = false;

    window.clearTimeout(box._eisRemoveTimer);

    box._eisRemoveTimer = window.setTimeout(() => {
        box.hidden = true;
    }, 6500);
}

function setHomepageImagePreviewEmpty(previewId, label) {
    const preview = document.getElementById(previewId);
    if (!preview) return;

    const message = document.createElement("span");
    message.textContent = label + " has not been uploaded.";
    preview.replaceChildren(message);
}

async function handleHomepageImageRemove(event) {
    const button = event.target.closest("[data-eis-remove-home-image]");
    if (!button) return;

    const key = button.dataset.eisRemoveHomeImage;
    const config = Object.values(EIS_HOME_IMAGE_PREVIEWS)
        .find(item => item.key === key);

    if (!config) return;

    event.preventDefault();
    event.stopPropagation();

    const previewId = Object.keys(EIS_HOME_IMAGE_PREVIEWS)
        .find(id => EIS_HOME_IMAGE_PREVIEWS[id].key === key);

    const fileInput = document.getElementById(config.inputId);

    // Clear an unsaved file selection without deleting the saved image.
    if (fileInput && fileInput.files && fileInput.files.length) {
        fileInput.value = "";

        try {
            const { data, error } = await supabase
                .from("site_settings")
                .select("setting_value")
                .eq("setting_key", "home_images")
                .maybeSingle();

            if (error) throw error;

            const savedImages = normalizeSettingValue(
                data && data.setting_value ? data.setting_value : {}
            );

            window.EISSiteSettings = window.EISSiteSettings || {};
            window.EISSiteSettings.home_images = savedImages;

            const savedUrl = getSettingImageUrl(savedImages[key]);

            if (savedUrl) {
                const image = document.createElement("img");
                image.src = savedUrl;
                image.alt = config.label;
                image.loading = "lazy";

                const preview = document.getElementById(previewId);
                if (preview) preview.replaceChildren(image);

                addHomepageImageRemoveButtons();
            } else {
                setHomepageImagePreviewEmpty(previewId, config.label);
            }

            showHomepageImageRemoveFeedback(
                "The selected replacement image has been cleared. The saved image has not been deleted."
            );
        } catch (error) {
            console.error("Unable to reset homepage image preview:", error);
            setHomepageImagePreviewEmpty(previewId, config.label);
            showHomepageImageRemoveFeedback(
                "The selected image was cleared, but the saved preview could not be reloaded.",
                "error"
            );
        }

        return;
    }

    if (!window.confirm("Remove " + config.label + " from the website?")) {
        return;
    }

    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = "Removing...";

    try {
        const {
            data: { user },
            error: userError
        } = await supabase.auth.getUser();

        if (userError) throw userError;
        if (!user) {
            throw new Error("Please sign in again before removing a homepage image.");
        }

        const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .single();

        if (profileError) throw profileError;

        if (!profile || !["admin", "super_admin"].includes(
            String(profile.role || "").toLowerCase()
        )) {
            throw new Error("Administrator permission is required.");
        }

        const { data: settingRow, error: settingError } = await supabase
            .from("site_settings")
            .select("setting_value")
            .eq("setting_key", "home_images")
            .maybeSingle();

        if (settingError) throw settingError;

        const currentImages = normalizeSettingValue(
            settingRow && settingRow.setting_value
                ? settingRow.setting_value
                : {}
        );

        const imageToRemove = currentImages[key];

        if (!imageToRemove || !imageToRemove.url) {
            setHomepageImagePreviewEmpty(previewId, config.label);
            showHomepageImageRemoveFeedback(
                config.label + " is already removed."
            );
            return;
        }

        const updatedImages = { ...currentImages };
        delete updatedImages[key];

        const { error: saveError } = await supabase
            .from("site_settings")
            .upsert({
                setting_key: "home_images",
                setting_value: updatedImages,
                updated_by: user.id
            }, {
                onConflict: "setting_key"
            });

        if (saveError) throw saveError;

        window.EISSiteSettings = window.EISSiteSettings || {};
        window.EISSiteSettings.home_images = updatedImages;

        if (fileInput) fileInput.value = "";

        setHomepageImagePreviewEmpty(previewId, config.label);

        let storageWarning = "";

        // Delete only files belonging to this exact homepage image folder.
        if (
            imageToRemove.path &&
            imageToRemove.path.startsWith(
                "site-settings/" + config.folder + "/"
            )
        ) {
            const { error: storageError } = await supabase.storage
                .from("site-assets")
                .remove([imageToRemove.path]);

            if (storageError) {
                console.warn(
                    "Homepage image removed from settings, but storage cleanup failed:",
                    storageError
                );
                storageWarning =
                    " The website image is removed, but its old storage file could not be cleaned up.";
            }
        }

        showHomepageImageRemoveFeedback(
            config.label + " has been removed successfully." + storageWarning
        );

    } catch (error) {
        console.error("Homepage image removal error:", error);

        showHomepageImageRemoveFeedback(
            error.message || ("Unable to remove " + config.label + "."),
            "error"
        );

    } finally {
        if (button.isConnected) {
            button.disabled = false;
            button.textContent = originalText;
        }
    }
}

function initializeHomepageImageRemoveControls() {
    const section = document.getElementById("section-site-settings");
    if (!section || section.dataset.eisRemoveControlsReady === "true") {
        return;
    }

    section.dataset.eisRemoveControlsReady = "true";

    addHomepageImageRemoveStyles();
    addHomepageImageRemoveButtons();

    const observer = new MutationObserver(() => {
        addHomepageImageRemoveButtons();
    });

    observer.observe(section, {
        childList: true,
        subtree: true
    });

    section.addEventListener("click", handleHomepageImageRemove);
}

if (typeof document !== "undefined") {
    const startHomepageImageRemoveControls = () => {
        initializeHomepageImageRemoveControls();

        // Site Settings markup is generated asynchronously by the admin module.
        const pageObserver = new MutationObserver(() => {
            initializeHomepageImageRemoveControls();

            const section = document.getElementById("section-site-settings");
            if (section && section.dataset.eisRemoveControlsReady === "true") {
                pageObserver.disconnect();
            }
        });

        pageObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    };

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            startHomepageImageRemoveControls,
            { once: true }
        );
    } else {
        startHomepageImageRemoveControls();
    }
           }
