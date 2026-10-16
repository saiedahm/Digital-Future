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
    const orderID = String(req.body && req.body.orderID || "").trim();
    const planId = String(req.body && req.body.planId || "").trim();
    const plan = PLANS[planId];
    if (!/^[A-Z0-9-]{5,80}$/i.test(orderID) || !plan) {
      return res.status(400).json({ error: "Invalid order or plan." });
    }
    const token = await getAccessToken();
    const response = await fetch(apiBase() + "/v2/checkout/orders/" + encodeURIComponent(orderID) + "/capture", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
        Accept: "application/json",
        "PayPal-Request-Id": "capture-" + orderID
      },
      body: "{}"
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.status !== "COMPLETED") {
      console.error("PayPal capture failed:", response.status, data.name || data.status || "unknown");
      return res.status(502).json({ error: "PayPal hat die Zahlung noch nicht als abgeschlossen bestätigt." });
    }
    const unit = Array.isArray(data.purchase_units) ? data.purchase_units[0] : null;
    const capture = unit && unit.payments && Array.isArray(unit.payments.captures)
      ? unit.payments.captures[0]
      : null;
    const amount = capture && capture.amount;
    if (!unit || unit.custom_id !== planId || !amount ||
        amount.currency_code !== "EUR" || amount.value !== plan.amount ||
        !capture.id || capture.status !== "COMPLETED") {
      console.error("PayPal capture verification mismatch for order:", orderID);
      return res.status(409).json({ error: "Die Zahlungsdetails stimmen nicht mit dem gewählten Tarif überein." });
    }
    return res.status(200).json({
      status: "COMPLETED",
      paymentStatus: "COMPLETED",
      captureID: capture.id,
      orderID: data.id,
      planId,
      amount: amount.value,
      currency: amount.currency_code
    });
  } catch (error) {
    console.error("PayPal capture error:", error.message);
    return res.status(error.statusCode || 502).json({
      error: error.statusCode === 503
        ? "PayPal ist serverseitig noch nicht vollständig konfiguriert."
        : "PayPal konnte die Zahlung nicht bestätigen."
    });
  }
};
