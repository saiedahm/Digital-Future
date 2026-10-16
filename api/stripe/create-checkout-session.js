const PLANS = Object.freeze({
  "pro-ai-pass": { name: "Pro AI Pass", amount: 2900 },
  "enterprise-vip": { name: "Enterprise VIP", amount: 9900 }
});
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({error:"Method not allowed"}); }
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret || !secret.startsWith("sk_")) return res.status(503).json({error:"Stripe ist serverseitig noch nicht konfiguriert."});
  const planId = String(req.body && req.body.planId || "");
  const plan = PLANS[planId];
  if (!plan) return res.status(400).json({error:"Ungültiger Tarif."});
  const origin = req.headers.origin;
  if (!origin || !["https://digital-future.ai","https://www.digital-future.ai"].includes(origin)) return res.status(403).json({error:"Nicht erlaubter Website-Ursprung."});
  try {
    const params = new URLSearchParams({
      mode:"subscription",
      "success_url":origin+"/?stripe=success&session_id={CHECKOUT_SESSION_ID}",
      "cancel_url":origin+"/?stripe=cancelled",
      "line_items[0][price_data][currency]":"eur",
      "line_items[0][price_data][unit_amount]":String(plan.amount),
      "line_items[0][price_data][recurring][interval]":"month",
      "line_items[0][price_data][product_data][name]":plan.name,
      "line_items[0][price_data][product_data][description]":"DIGITAL-FUTURE.AI Monatsabonnement",
      "subscription_data[metadata][planId]":planId,
      "metadata[planId]":planId
    });
    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method:"POST", headers:{Authorization:"Bearer "+secret,"Content-Type":"application/x-www-form-urlencoded"}, body:params
    });
    const data = await response.json().catch(()=>({}));
    if (!response.ok || !data.url || !data.url.startsWith("https://checkout.stripe.com/")) {
      console.error("Stripe Checkout failed:", response.status, data.error && data.error.type);
      return res.status(502).json({error:"Stripe konnte die Checkout-Sitzung nicht erstellen. Bitte Konfiguration prüfen."});
    }
    return res.status(200).json({url:data.url,sessionId:data.id});
  } catch (error) {
    console.error("Stripe Checkout exception:", error.message);
    return res.status(502).json({error:"Stripe Checkout ist momentan nicht verfügbar."});
  }
};
