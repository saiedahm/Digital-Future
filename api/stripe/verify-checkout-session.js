module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).json({error:"Method not allowed"}); }
  const secret = process.env.STRIPE_SECRET_KEY;
  const sessionId = String(req.query && req.query.session_id || "");
  if (!secret || !secret.startsWith("sk_")) return res.status(503).json({error:"Stripe ist serverseitig noch nicht konfiguriert."});
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) return res.status(400).json({error:"Ungültige Checkout-Sitzung."});
  try {
    const response = await fetch("https://api.stripe.com/v1/checkout/sessions/" + encodeURIComponent(sessionId), {headers:{Authorization:"Bearer "+secret}});
    const data = await response.json().catch(()=>({}));
    if (!response.ok) return res.status(502).json({error:"Stripe-Zahlungsstatus konnte nicht geprüft werden."});
    return res.status(200).json({paid:data.payment_status==="paid" && !!data.subscription, paymentStatus:data.payment_status, status:data.status, subscriptionId:typeof data.subscription==="string"?data.subscription:null, planId:data.metadata&&data.metadata.planId||null});
  } catch (error) {
    console.error("Stripe checkout verification failed:",error.message);
    return res.status(502).json({error:"Stripe-Zahlungsstatus konnte nicht geprüft werden."});
  }
};
