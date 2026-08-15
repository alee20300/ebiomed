-- Notification outbox delivery state for requester and PM escalation messages.

ALTER TABLE ebiomed.request_notifications
  ADD COLUMN IF NOT EXISTS delivery_channel text NOT NULL DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS delivery_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS delivery_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS provider_message_id text;

ALTER TABLE ebiomed.pm_escalation_notifications
  ADD COLUMN IF NOT EXISTS delivery_channel text NOT NULL DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS delivery_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS delivery_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS provider_message_id text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'request_notifications_delivery_status_valid') THEN
    ALTER TABLE ebiomed.request_notifications
      ADD CONSTRAINT request_notifications_delivery_status_valid
      CHECK (delivery_status IN ('pending', 'sent', 'failed', 'skipped')) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'request_notifications_delivery_channel_valid') THEN
    ALTER TABLE ebiomed.request_notifications
      ADD CONSTRAINT request_notifications_delivery_channel_valid
      CHECK (delivery_channel IN ('email', 'sms', 'whatsapp', 'webhook', 'in_app')) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pm_escalation_notifications_delivery_status_valid') THEN
    ALTER TABLE ebiomed.pm_escalation_notifications
      ADD CONSTRAINT pm_escalation_notifications_delivery_status_valid
      CHECK (delivery_status IN ('pending', 'sent', 'failed', 'skipped')) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pm_escalation_notifications_delivery_channel_valid') THEN
    ALTER TABLE ebiomed.pm_escalation_notifications
      ADD CONSTRAINT pm_escalation_notifications_delivery_channel_valid
      CHECK (delivery_channel IN ('email', 'sms', 'whatsapp', 'webhook', 'in_app')) NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_request_notifications_delivery_pending
  ON ebiomed.request_notifications(delivery_status, created_at)
  WHERE delivery_status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS idx_pm_escalation_notifications_delivery_pending
  ON ebiomed.pm_escalation_notifications(delivery_status, sent_at)
  WHERE delivery_status IN ('pending', 'failed');
