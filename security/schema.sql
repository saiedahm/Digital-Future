-- Apply through your migration process; do not execute automatically at app startup.
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS stripe_webhook_events_received_at_idx
  ON stripe_webhook_events (received_at);
