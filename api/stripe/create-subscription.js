const PLANS = Object.freeze({
  "pro-ai-pass": { name: "Pro AI Pass", amount: 2900 },
  "enterprise-vip": { name: "Enterprise VIP", amount: 9900 }
});
async function stripePost(secret, path, values) {
  const response = await fetch("https://api.stripe.com/v1/" + path, {
    method:"POST",
    headers:{Authorization:"Bearer "+secret,"Content-Type":"application/x-www-form-urlencoded"},
    body:new URLSearchParams(values)
  });
  const data = await response.json().catch(()=>({}));
  if (!response.ok) {
    console.error("Stripe API failure:",path,response.status,data.error&&data.error.type);
    const error = new Error("Stripe konnte das Abonnement nicht sicher erstellen.");
    error.statusCode = response.status >= 500 ? 502 : 400;
    throw error;
  }
  return data;
}
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control","no-store");
  res.setHeader("X-Content-Type-Options","nosniff");
  if (req.method !== "POST") { res.setHeader("Allow","POST"); return res.status(405).json({error:"Method not allowed"}); }
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret || !secret.startsWith("sk_")) return res.status(503).json({error:"Stripe ist serverseitig noch nicht konfiguriert."});
  const body = req.body || {};
  const planId = String(body.planId || "");
  const plan = PLANS[planId];
  const email = String(body.email || "").trim();
  const paymentMethodId = String(body.paymentMethodId || "");
  if (!plan || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^pm_[A-Za-z0-9]+$/.test(paymentMethodId)) return res.status(400).json({error:"Ungültige Tarif-, E-Mail- oder Zahlungsmethodendaten."});
  const origin = req.headers.origin;
  if (!origin || !["https://digital-future.ai","https://www.digital-future.ai"].includes(origin)) return res.status(403).json({error:"Nicht erlaubter Website-Ursprung."});
  try {
    const customer = await stripePost(secret,"customers",{email,"metadata[service]":"DIGITAL-FUTURE.AI"});
    await stripePost(secret,"payment_methods/"+encodeURIComponent(paymentMethodId)+"/attach",{customer:customer.id});
    const product = await stripePost(secret,"products",{name:plan.name,description:"DIGITAL-FUTURE.AI Monatsabonnement"});
    const subscription = await stripePost(secret,"subscriptions",{
      customer:customer.id,
      "items[0][price_data][currency]":"eur",
      "items[0][price_data][unit_amount]":String(plan.amount),
      "items[0][price_data][recurring][interval]":"month",
      "items[0][price_data][product]":product.id,
      default_payment_method:paymentMethodId,
      payment_behavior:"default_incomplete",
      "metadata[planId]":planId,
      "expand[0]":"latest_invoice.payment_intent"
    });
    const invoice = subscription.latest_invoice && typeof subscription.latest_invoice === "object" ? subscription.latest_invoice : null;
    const intent = invoice && invoice.payment_intent && typeof invoice.payment_intent === "object" ? invoice.payment_intent : null;
    return res.status(200).json({subscriptionId:subscription.id,status:subscription.status,paymentIntentClientSecret:intent&&intent.client_secret||null});
  } catch (error) {
    console.error("Stripe subscription creation failed:",error.message);
    return res.status(error.statusCode||502).json({error:error.statusCode===503?"Stripe ist serverseitig noch nicht konfiguriert.":error.message});
  }
};
