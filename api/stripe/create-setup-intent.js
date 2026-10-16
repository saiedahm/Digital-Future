const PLANS = new Set(["pro-ai-pass", "enterprise-vip"]);
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({error:"Method not allowed"}); }
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret || !secret.startsWith("sk_")) return res.status(503).json({error:"Stripe ist serverseitig noch nicht konfiguriert."});
  const planId = String(req.body && req.body.planId || "");
  const email = String(req.body && req.body.email || "").trim();
  if (!PLANS.has(planId) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({error:"Ungültiger Tarif oder ungültige E-Mail-Adresse."});
  try {
    const params = new URLSearchParams({usage:"off_session","payment_method_types[0]":"card","metadata[planId]":planId,"metadata[email]":email});
    const response = await fetch("https://api.stripe.com/v1/setup_intents", {method:"POST",headers:{Authorization:"Bearer "+secret,"Content-Type":"application/x-www-form-urlencoded"},body:params});
    const data = await response.json().catch(()=>({}));
    if (!response.ok || !data.client_secret) { console.error("Stripe SetupIntent failed:",response.status,data.error&&data.error.type); return res.status(502).json({error:"Stripe konnte die sichere Karteneinrichtung nicht starten."}); }
    return res.status(200).json({clientSecret:data.client_secret,setupIntentId:data.id});
  } catch (error) {
    console.error("Stripe SetupIntent exception:",error.message);
    return res.status(502).json({error:"Stripe konnte die sichere Karteneinrichtung nicht starten."});
  }
};
