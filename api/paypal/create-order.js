const PLANS = Object.freeze({
  "pro-ai-pass": { name: "Pro AI Pass", amount: "29.00" },
  "enterprise-vip": { name: "Enterprise VIP", amount: "99.00" }
});

function apiBase() {
  return process.env.PAYPAL_ENV === "sandbox"
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";
}

async function getAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !secret) {
    const error = new Error("PayPal server credentials are not configured.");
    error.statusCode = 503;
    throw error;
  }
  const response = await fetch(apiBase() + "/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(clientId + ":" + secret).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json"
    },
    body: "grant_type=client_credentials"
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    const error = new Error("PayPal could not authorize the server request.");
    error.statusCode = 502;
    throw error;
  }
  return data.access_token;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const planId = req.body && req.body.planId;
    const plan = PLANS[planId];
    if (!plan || req.body.currency !== "EUR") {
      return res.status(400).json({ error: "Invalid plan or currency." });
    }
    const token = await getAccessToken();
    const response = await fetch(apiBase() + "/v2/checkout/orders", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
        Accept: "application/json",
        "PayPal-Request-Id": "df-" + planId + "-" + require("crypto").randomUUID()
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          reference_id: planId,
          custom_id: planId,
          description: plan.name + " - Einmalzahlung",
          amount: { currency_code: "EUR", value: plan.amount }
        }],
        application_context: {
          brand_name: "DIGITAL-FUTURE.AI",
          landing_page: "BILLING",
          user_action: "PAY_NOW",
          shipping_preference: "NO_SHIPPING"
        }
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.id) {
      console.error("PayPal create-order failed:", response.status, data.name || "unknown");
      return res.status(502).json({ error: "PayPal konnte die Bestellung nicht erstellen." });
    }
    return res.status(200).json({ orderID: data.id });
  } catch (error) {
    console.error("PayPal create-order error:", error.message);
    return res.status(error.statusCode || 502).json({
      error: error.statusCode === 503
        ? "PayPal ist serverseitig noch nicht vollständig konfiguriert."
        : "PayPal konnte die Bestellung nicht vorbereiten."
    });
  }
};
