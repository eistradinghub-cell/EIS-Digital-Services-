const SUPABASE_URL = "https://mbihyrbfeatcynspzune.supabase.co";
const SUPABASE_PUBLIC_KEY = "sb_publishable_alh5WL2JbOK6yW_5z5Fq4A_kJQHWt1-";
const STATUS_ENDPOINT = SUPABASE_URL + "/rest/v1/site_runtime_status?select=maintenance_enabled,maintenance_message,expected_return_at&id=eq.true";

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
}

function maintenancePage(status) {
    const message = escapeHTML(status.maintenance_message || "We are carrying out scheduled maintenance. Please check back shortly.");
    const returnAt = status.expected_return_at ? new Date(status.expected_return_at) : null;
    const returnText = returnAt && !Number.isNaN(returnAt.getTime())
        ? returnAt.toLocaleString("en-NG", { day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit" })
        : "";
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#142d4e">
<meta name="robots" content="noindex,nofollow">
<meta http-equiv="refresh" content="60">
<title>Scheduled Maintenance | EIS Digital Services</title>
<style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#f4f7f8;color:#142d4e;font-family:Inter,Segoe UI,Arial,sans-serif}
main{width:min(100%,560px);padding:clamp(28px,6vw,48px);border:1px solid #e1e8eb;border-radius:18px;background:#fff;box-shadow:0 18px 55px rgba(20,45,78,.08);text-align:center}
.brand{display:inline-flex;align-items:center;gap:10px;margin-bottom:34px;font-size:17px;font-weight:750;letter-spacing:.01em}.mark{display:grid;place-items:center;width:38px;height:38px;border-radius:11px;background:#168477;color:white;font-weight:800}
.status{display:inline-flex;align-items:center;gap:8px;margin-bottom:18px;padding:7px 11px;border-radius:20px;background:#fff5e9;color:#945318;font-size:11px;font-weight:750;letter-spacing:.07em;text-transform:uppercase}.dot{width:7px;height:7px;border-radius:50%;background:#d18a31}
h1{margin:0 0 14px;font-size:clamp(27px,5vw,36px);line-height:1.15;letter-spacing:-.035em}p{margin:0;color:#61717f;font-size:15px;line-height:1.75}
.return{margin-top:22px;padding:14px;border-radius:10px;background:#f4f8f7;color:#536c68;font-size:13px;line-height:1.5}.return strong{display:block;margin-bottom:3px;color:#142d4e}
.footer{margin-top:30px;padding-top:20px;border-top:1px solid #edf0f2;color:#89959e;font-size:12px}.admin{display:inline-block;margin-top:17px;color:#61717f;font-size:12px;text-decoration:none}.admin:hover{color:#168477}
</style>
</head>
<body>
<main>
<div class="brand"><span class="mark">EIS</span><span>EIS Digital Services</span></div>
<div class="status"><span class="dot"></span> Scheduled maintenance</div>
<h1>We’ll be back shortly.</h1>
<p>${message}</p>
${returnText ? `<div class="return"><strong>Expected return</strong>${escapeHTML(returnText)}</div>` : ""}
<div class="footer">Your submitted information remains safe. Thank you for your patience.</div>
<a class="admin" href="/index.html?admin_access=1">Administrator sign-in</a>
</main>
</body>
</html>`;
}

async function readMaintenanceStatus() {
    const cacheKey = new Request("https://eis-maintenance-cache.invalid/site-runtime-status");
    try {
        if (typeof caches !== "undefined" && caches.default) {
            const cached = await caches.default.match(cacheKey);
            if (cached) return await cached.json();
        }
    } catch (_) {}

    const response = await fetch(STATUS_ENDPOINT, {
        headers: {
            "apikey": SUPABASE_PUBLIC_KEY,
            "Authorization": "Bearer " + SUPABASE_PUBLIC_KEY,
            "Accept": "application/json"
        }
    });
    if (!response.ok) throw new Error("Maintenance status unavailable");
    const rows = await response.json();
    const status = Array.isArray(rows) ? rows[0] : null;
    if (!status) throw new Error("Maintenance status row missing");

    try {
        if (typeof caches !== "undefined" && caches.default) {
            await caches.default.put(cacheKey, new Response(JSON.stringify(status), {
                headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=3" }
            }));
        }
    } catch (_) {}
    return status;
}

export async function onRequest(context) {
    const url = new URL(context.request.url);
    const path = url.pathname.toLowerCase();

    // Keep the administrator workspace and the payment provider's webhook online.
    if (path === "/admin.html" || path === "/api/paystack/webhook") {
        return context.next();
    }

    // Allows administrators to reach the existing sign-in page during maintenance.
    if (path === "/index.html" && url.searchParams.get("admin_access") === "1") {
        return context.next();
    }

    try {
        const status = await readMaintenanceStatus();
        if (status.maintenance_enabled !== true) return context.next();

        const headers = {
            "Cache-Control": "no-store, max-age=0",
            "Retry-After": "60",
            "X-Robots-Tag": "noindex, nofollow"
        };
        if (path.startsWith("/api/")) {
            return new Response(JSON.stringify({
                error: "maintenance_mode",
                message: status.maintenance_message || "The website is temporarily unavailable while maintenance is in progress."
            }), {
                status: 503,
                headers: { ...headers, "Content-Type": "application/json; charset=utf-8" }
            });
        }
        return new Response(maintenancePage(status), {
            status: 503,
            headers: { ...headers, "Content-Type": "text/html; charset=utf-8" }
        });
    } catch (error) {
        // Fail open if the status service is unreachable; never take the site offline by accident.
        console.error("EIS maintenance check failed:", error);
        return context.next();
    }
}
