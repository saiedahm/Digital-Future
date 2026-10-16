const allowedOrigins = new Set([
  "https://digital-future.ai",
  "https://www.digital-future.ai"
]);

module.exports = function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const clientId = process.env.PAYPAL_CLIENT_ID;
  if (!clientId) {
    return res.status(503).json({
      error: "PayPal ist noch nicht konfiguriert. PAYPAL_CLIENT_ID fehlt."
    });
  }
  return res.status(200).json({ clientId });
};
