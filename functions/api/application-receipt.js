const SUPABASE_URL = "https://mbihyrbfeatcynspzune.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_alh5WL2JbOK6yW_5z5Fq4A_kJQHWt1-";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

export async function onRequestPost({ request, env }) {
  try {
    const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Authentication required." }, 401);

    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
    const resendApiKey = env.RESEND_API_KEY;
    const emailFrom = env.EMAIL_FROM;

    if (!serviceRoleKey || !resendApiKey || !emailFrom) {
      return json({ error: "Email service is not configured yet." }, 503);
    }

    const authResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`
      }
    });
    if (!authResponse.ok) return json({ error: "Please sign in again." }, 401);
    const user = await authResponse.json();

    let body;
    try { body = await request.json(); }
    catch { return json({ error: "Invalid request body." }, 400); }

    const applicationId = String(body?.application_id || "");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(applicationId)) {
      return json({ error: "Invalid application reference." }, 400);
    }

    const appResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/applications?id=eq.${encodeURIComponent(applicationId)}&user_id=eq.${encodeURIComponent(user.id)}&select=id,user_id,service_name,amount,status,created_at,form_data`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`
        }
      }
    );
    if (!appResponse.ok) return json({ error: "Could not retrieve your application." }, 500);

    const rows = await appResponse.json();
    const application = rows[0];
    if (!application) return json({ error: "Application not found." }, 404);

    const formData = application.form_data && typeof application.form_data === "object"
      ? application.form_data
      : {};
    const recipient = String(formData.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
      return json({ error: "The application does not contain a valid email address." }, 422);
    }

    const customerName = [
      formData.agent_first_name,
      formData.middle_name,
      formData.last_name
    ].map(value => String(value || "").trim()).filter(Boolean).join(" ") || "Valued Customer";
    const reference = String(application.id).slice(0, 8).toUpperCase();
    const submittedAt = new Date(application.created_at).toLocaleString("en-NG", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "Africa/Lagos"
    });
    const serviceName = String(application.service_name || "Requested service");
    const safeName = escapeHtml(customerName);
    const safeService = escapeHtml(serviceName);
    const safeReference = escapeHtml(reference);
    const safeSubmittedAt = escapeHtml(submittedAt);

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `eis-application-receipt-${application.id}`
      },
      body: JSON.stringify({
        from: emailFrom,
        to: [recipient],
        subject: "We have received your application | EIS Digital Services",
        html: `
          <div style="margin:0;padding:32px 12px;background:#f4f7f8;font-family:Arial,Helvetica,sans-serif;color:#243342">
            <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e1e8eb;border-radius:12px;overflow:hidden">
              <div style="padding:26px 30px;background:#142d4e;color:#ffffff">
                <div style="font-size:13px;letter-spacing:1.5px;font-weight:bold;color:#cfe7e2">EIS DIGITAL SERVICES</div>
                <h1 style="margin:12px 0 0;font-size:23px;line-height:1.35">Application received</h1>
              </div>
              <div style="padding:30px">
                <p style="font-size:16px">Dear ${safeName},</p>
                <p style="font-size:15px;line-height:1.8;color:#536170">Thank you for choosing EIS Digital Services. This is to confirm that we have successfully received your application. Our team will review the information you submitted and process your request.</p>
                <div style="margin:24px 0;padding:18px;background:#f5f8f8;border:1px solid #e1e8eb;border-radius:8px">
                  <p style="margin:0 0 12px;color:#687783;font-size:12px;font-weight:bold">APPLICATION SUMMARY</p>
                  <p style="margin:8px 0"><strong>Service:</strong> ${safeService}</p>
                  <p style="margin:8px 0"><strong>Reference:</strong> ${safeReference}</p>
                  <p style="margin:8px 0"><strong>Date received:</strong> ${safeSubmittedAt}</p>
                  <p style="margin:8px 0"><strong>Current status:</strong> In review</p>
                </div>
                <p style="font-size:14px;line-height:1.8;color:#536170">Please keep your application reference for future enquiries. You can also sign in to your EIS customer dashboard to follow the progress of your application.</p>
                <p style="font-size:14px;line-height:1.8;color:#536170">If you have any questions, please contact our support team through the official support channel on our website.</p>
                <p style="margin-top:28px;font-size:14px;line-height:1.7">Kind regards,<br><strong>EIS Digital Services Team</strong></p>
              </div>
              <div style="padding:16px 30px;background:#f8fafb;border-top:1px solid #e1e8eb;color:#84909a;font-size:11px">This is an automated confirmation. Please do not reply directly to this email.</div>
            </div>
          </div>
        `
      })
    });

    if (!emailResponse.ok) {
      const providerError = await emailResponse.text();
      console.error("Resend email error:", providerError);
      return json({ error: "The application was received, but the confirmation email could not be sent." }, 502);
    }

    return json({ success: true });
  } catch (error) {
    console.error("Application receipt error:", error);
    return json({ error: "An unexpected email service error occurred." }, 500);
  }
}
