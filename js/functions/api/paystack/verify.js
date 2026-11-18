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
    const reference = String(body.reference || "").trim();

    if (!reference) return json({ error: "Payment reference is required." }, 400);

    const paymentResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/payments?reference=eq.${encodeURIComponent(reference)}&user_id=eq.${encodeURIComponent(user.id)}&select=reference,amount,status,service_name`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`
        }
      }
    );

    if (!paymentResponse.ok) {
      return json({ error: "Could not retrieve payment record." }, 500);
    }

    const payments = await paymentResponse.json();
    const payment = payments[0];

    if (!payment) return json({ error: "Payment record not found." }, 404);

    if (payment.status === "used") {
      return json({
        success: true,
        status: "used",
        reference,
        message: "This payment has already been used."
      });
    }

    if (payment.status === "successful") {
      return json({
        success: true,
        status: "successful",
        reference,
        service_name: payment.service_name,
        amount: payment.amount
      });
    }

    if (payment.status !== "pending") {
      return json({ error: "This payment is not pending." }, 400);
    }

    const paystackResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: { Authorization: `Bearer ${paystackKey}` }
      }
    );

    const result = await paystackResponse.json();

    if (!paystackResponse.ok || !result.status || !result.data) {
      return json({ error: "Could not verify payment with Paystack." }, 502);
    }

    const transaction = result.data;

    if (
      transaction.status !== "success" ||
      transaction.reference !== reference ||
      transaction.currency !== "NGN" ||
      Number(transaction.amount) !== Math.round(Number(payment.amount) * 100)
    ) {
      return json({
        success: false,
        status: "pending",
        message: "Payment has not been confirmed."
      }, 402);
    }

    const updateResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/payments?reference=eq.${encodeURIComponent(reference)}&user_id=eq.${encodeURIComponent(user.id)}&status=eq.pending`,
      {
        method: "PATCH",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
          Prefer: "return=representation"
        },
        body: JSON.stringify({ status: "successful" })
      }
    );

    if (!updateResponse.ok) {
      return json({ error: "Could not update payment status." }, 500);
    }

    const updatedPayments = await updateResponse.json();

    if (!updatedPayments.length) {
      return json({ error: "Payment status changed. Please verify again." }, 409);
    }

    return json({
      success: true,
      status: "successful",
      reference,
      service_name: payment.service_name,
      amount: payment.amount
    });

  } catch (error) {
    return json({ error: "An unexpected server error occurred." }, 500);
  }
      }
