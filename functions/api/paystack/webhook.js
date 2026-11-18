const SUPABASE_URL = "https://mbihyrbfeatcynspzune.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_alh5WL2JbOK6yW_5z5Fq4A_kJQHWt1-";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}

function toHex(buffer) {
  return [...new Uint8Array(buffer)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

async function verifyPaystackSignature(rawBody, secret, signature) {
  if (!signature || !/^[a-f0-9]{128}$/i.test(signature)) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"]
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  return toHex(digest).toLowerCase() === signature.toLowerCase();
}

export async function onRequestPost({ request, env }) {
  try {
    const paystackKey = env.PAYSTACK_SECRET_KEY;
    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!paystackKey || !serviceRoleKey) {
      return json({ error: "Webhook configuration is incomplete." }, 500);
    }

    const rawBody = await request.text();
    const signature = request.headers.get("x-paystack-signature");
    if (!(await verifyPaystackSignature(rawBody, paystackKey, signature))) {
      return json({ error: "Invalid webhook signature." }, 401);
    }

    let event;
    try { event = JSON.parse(rawBody); }
    catch { return json({ error: "Invalid event payload." }, 400); }

    // Only successful charge events can change a payment to successful.
    if (event?.event !== "charge.success") return json({ received: true });

    const tx = event.data;
    const reference = tx?.reference;
    if (
      typeof reference !== "string" ||
      !/^EIS[-_][a-f0-9]{32}$/i.test(reference) ||
      tx?.status !== "success" ||
      tx?.currency !== "NGN" ||
      !Number.isSafeInteger(Number(tx?.amount)) ||
      Number(tx.amount) <= 0
    ) {
      return json({ error: "Invalid successful transaction details." }, 400);
    }

    const headers = {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json"
    };

    const lookup = await fetch(
      `${SUPABASE_URL}/rest/v1/payments?reference=eq.${encodeURIComponent(reference)}&select=reference,amount,status`,
      { headers }
    );
    if (!lookup.ok) return json({ error: "Could not look up payment." }, 502);

    const rows = await lookup.json();
    const payment = rows[0];
    if (!payment) return json({ error: "Payment reference not found." }, 404);

    const expectedKobo = Math.round(Number(payment.amount) * 100);
    if (!Number.isSafeInteger(expectedKobo) || expectedKobo <= 0 || Number(tx.amount) !== expectedKobo) {
      return json({ error: "Paid amount does not match the expected amount." }, 409);
    }

    // Idempotent: never downgrade a consumed payment or overwrite another state.
    if (payment.status === "successful" || payment.status === "used") {
      return json({ received: true, already_processed: true });
    }
    if (payment.status !== "pending") {
      return json({ received: true, ignored: true });
    }

    const update = await fetch(
      `${SUPABASE_URL}/rest/v1/payments?reference=eq.${encodeURIComponent(reference)}&status=eq.pending`,
      {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify({ status: "successful" })
      }
    );
    if (!update.ok) return json({ error: "Could not update payment." }, 502);

    const changed = await update.json();
    return json({ received: true, processed: changed.length === 1 });
  } catch {
    return json({ error: "Webhook processing failed." }, 500);
  }
}
