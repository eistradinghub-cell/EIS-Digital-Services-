const SUPABASE_URL = "https://mbihyrbfeatcynspzune.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_alh5WL2JbOK6yW_5z5Fq4A_kJQHWt1-";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

export async function onRequestPost({ request, env }) {
  try {
    const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");

    if (!token) return json({ error: "Authentication required." }, 401);

    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
    const paystackKey = env.PAYSTACK_SECRET_KEY;

    if (!serviceRoleKey || !paystackKey) {
      return json({ error: "Server payment configuration is incomplete." }, 500);
    }

    const authResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`
      }
    });

    if (!authResponse.ok) return json({ error: "Please sign in again." }, 401);

    const user = await authResponse.json();
    const body = await request.json();
    const serviceId = body.service_id;

    if (!serviceId) return json({ error: "Service is required." }, 400);

    const serviceResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/services?id=eq.${encodeURIComponent(serviceId)}&select=id,name,price`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`
        }
      }
    );

    if (!serviceResponse.ok) {
      return json({ error: "Could not retrieve service details." }, 500);
    }

    const services = await serviceResponse.json();
    const service = services[0];

    if (!service || !Number.isFinite(Number(service.price)) || Number(service.price) <= 0) {
      return json({ error: "Invalid service or price." }, 400);
    }

    const amount = Number(service.price);
    const reference = `EIS_${crypto.randomUUID().replace(/-/g, "")}`;

    const paymentInsert = await fetch(`${SUPABASE_URL}/rest/v1/payments`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify({
        reference,
        user_id: user.id,
        service_name: service.name,
        amount,
        status: "pending"
      })
    });

    if (!paymentInsert.ok) {
      return json({ error: "Could not create payment record." }, 500);
    }

    const paystackResponse = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paystackKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: user.email,
        amount: Math.round(amount * 100),
        currency: "NGN",
        reference,
        callback_url: "https://eis-digital-services1.pages.dev/dashboard.html"
      })
    });

    const result = await paystackResponse.json();

    if (!paystackResponse.ok || !result.status || !result.data?.authorization_url) {
      await fetch(
        `${SUPABASE_URL}/rest/v1/payments?reference=eq.${encodeURIComponent(reference)}`,
        {
          method: "PATCH",
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ status: "failed" })
        }
      );

      return json({ error: "Paystack could not initialize this payment." }, 502);
    }

    return json({
      success: true,
      authorization_url: result.data.authorization_url,
      reference,
      amount,
      service_name: service.name
    });
  } catch (error) {
    return json({ error: "An unexpected server error occurred." }, 500);
  }
        }
