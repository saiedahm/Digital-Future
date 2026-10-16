module.exports = function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).json({error:"Method not allowed"}); }
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
  if (!publishableKey || !publishableKey.startsWith("pk_")) return res.status(503).json({error:"Stripe ist noch nicht konfiguriert. STRIPE_PUBLISHABLE_KEY fehlt."});
  return res.status(200).json({publishableKey});
};
