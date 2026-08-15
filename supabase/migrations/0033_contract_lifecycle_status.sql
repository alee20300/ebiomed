-- Phase 5 hardening: durable AMC/CMC contract lifecycle status refresh

ALTER TABLE ebiomed.contracts
  ADD COLUMN IF NOT EXISTS status_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS expiry_alert_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_contracts_status_review
  ON ebiomed.contracts(status, status_reviewed_at DESC NULLS LAST);
