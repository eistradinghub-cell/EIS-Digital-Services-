const SUPABASE_URL = "https://mbihyrbfeatcynspzune.supabase.co";

const SUPABASE_ANON_KEY =
  "sb_publishable_alh5WL2JbOK6yW_5z5Fq4A_kJQHWt1-";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  });
}

export async function onRequestPost({ request, env }) {
  try {
    const token = request.headers
      .get("Authorization")
      ?.replace(/^Bearer\s+/i, "");

    if (!token) {
      return json({ error: "Authentication required." }, 401);
    }

    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
    const paystackKey = env.PAYSTACK_SECRET_KEY;

    if (!serviceRoleKey || !paystackKey) {
      return json({
        error: "Server payment configuration is incomplete."
      }, 500);
    }

    // Verify authenticated user
    const authResponse = await fetch(
      `${SUPABASE_URL}/auth/v1/user`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${token}`
        }
      }
    );

    if (!authResponse.ok) {
      return json({ error: "Please sign in again." }, 401);
    }

    const user = await authResponse.json();

    // Validate request
    let body;

    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid request body." }, 400);
    }

    const reference = body?.reference;

    if (
      typeof reference !== "string" ||
      !/^EIS[-_][a-f0-9]{32}$/i.test(reference)
    ) {
      return json({ error: "Invalid payment reference." }, 400);
    }

    // Retrieve payment belonging to authenticated user
    const paymentResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/payments?reference=eq.${encodeURIComponent(reference)}&user_id=eq.${encodeURIComponent(user.id)}&select=reference,user_id,service_name,amount,status`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`
        }
      }
    );

    if (!paymentResponse.ok) {
      return json({ error: "Could not retrieve payment." }, 500);
    }

    const payments = await paymentResponse.json();
    const payment = payments[0];

    if (!payment) {
      return json({ error: "Payment record not found." }, 404);
    }

    if (payment.status === "used") {
      return json({
        error: "This payment has already been used."
      }, 409);
    }

    if (payment.status === "failed") {
      return json({ error: "This payment was unsuccessful." }, 400);
    }

    if (
      !Number.isFinite(Number(payment.amount)) ||
      Number(payment.amount) <= 0
    ) {
      return json({ error: "Invalid payment amount." }, 400);
    }

    // Return existing verified payment
    if (payment.status === "successful") {
      return json({
        success: true,
        verified: true,
        reference,
        service_name: payment.service_name,
        amount: Number(payment.amount)
      });
    }

    if (payment.status !== "pending") {
      return json({ error: "Payment cannot be verified." }, 409);
    }

    // Verify transaction directly with Paystack
    const verifyResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: {
          Authorization: `Bearer ${paystackKey}`,
          "Content-Type": "application/json"
        }
      }
    );

    const result = await verifyResponse.json();

    if (!verifyResponse.ok || !result.status || !result.data) {
      return json({
        error: "Could not verify payment with Paystack."
      }, 502);
    }

    const transaction = result.data;
    const expectedAmount = Math.round(Number(payment.amount) * 100);

    // Confirm all important transaction details
    if (
      transaction.reference !== reference ||
      transaction.status !== "success" ||
      transaction.currency !== "NGN" ||
      Number(transaction.amount) !== expectedAmount ||
      String(transaction.customer?.email || "").trim().toLowerCase() !==
        String(user.email || "").trim().toLowerCase()
    ) {
      return json({
        error: "Payment details could not be confirmed."
      }, 409);
    }

    // Update payment only if it is still pending
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
        body: JSON.stringify({
          status: "successful"
        })
      }
    );

    if (!updateResponse.ok) {
      return json({
        error: "Could not update payment status."
      }, 500);
    }

    const updatedPayments = await updateResponse.json();

    if (!updatedPayments.length) {
      return json({
        error: "Payment status changed. Please verify again."
      }, 409);
    }

    return json({
      success: true,
      verified: true,
      reference,
      service_name: payment.service_name,
      amount: Number(payment.amount)
    });

  } catch (error) {
    return json({
      error: "An unexpected server error occurred."
    }, 500);
  }
        }
