import express, { Router } from "express";
import Stripe from "stripe";
import { Pool } from "pg";

const router = Router();
const stripeKey = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const databaseUrl = process.env.DATABASE_URL;

if (process.env.NODE_ENV === "production" && (!stripeKey || !webhookSecret || !databaseUrl)) {
  throw new Error("Required Stripe/PostgreSQL environment is missing.");
}

const stripe = stripeKey ? new Stripe(stripeKey) : null;
const pool = databaseUrl ? new Pool({
  connectionString: databaseUrl,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: true } : undefined,
  max: 10,
  connectionTimeoutMillis: 3000,
  idleTimeoutMillis: 10000,
}) : null;

/**
 * Mount before express.json(): app.use("/api/stripe-webhook", stripeWebhookRouter)
 * This route verifies the exact raw request bytes and durably records event IDs once.
 */
router.post("/", express.raw({ type: "application/json", limit: "1mb" }), async (req, res) => {
  if (!stripe || !webhookSecret || !pool) return res.status(503).json({ error: "Payment service unavailable" });
  const signature = req.header("stripe-signature");
  if (!signature || !Buffer.isBuffer(req.body)) return res.status(400).json({ error: "Invalid webhook request" });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret, 300);
  } catch {
    return res.status(400).json({ error: "Invalid webhook signature" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      "INSERT INTO stripe_webhook_events (event_id, event_type) VALUES ($1, $2) ON CONFLICT (event_id) DO NOTHING RETURNING event_id",
      [event.id, event.type],
    );
    if (result.rowCount === 0) {
      await client.query("COMMIT");
      return res.status(200).json({ received: true, duplicate: true });
    }

    // Intentionally no auto-fulfillment: implement event-specific checks against a pending
    // local order (amount, currency, Stripe IDs, customer) before marking paid or shipping.
    await client.query("COMMIT");
    return res.status(200).json({ received: true });
  } catch {
    await client.query("ROLLBACK").catch(() => undefined);
    return res.status(500).json({ error: "Webhook processing failed" });
  } finally {
    client.release();
  }
});

export const stripeWebhookRouter = router;
