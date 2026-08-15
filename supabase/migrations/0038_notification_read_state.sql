-- Read state for shell notification center.

ALTER TABLE ebiomed.request_notifications
  ADD COLUMN IF NOT EXISTS read_at timestamptz;

ALTER TABLE ebiomed.pm_escalation_notifications
  ADD COLUMN IF NOT EXISTS read_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_request_notifications_unread
  ON ebiomed.request_notifications(read_at, created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pm_escalation_notifications_unread
  ON ebiomed.pm_escalation_notifications(read_at, sent_at DESC)
  WHERE read_at IS NULL;

GRANT UPDATE(read_at) ON ebiomed.request_notifications TO authenticated;
GRANT UPDATE(read_at) ON ebiomed.pm_escalation_notifications TO authenticated;

DROP POLICY IF EXISTS "Request notification read state updateable by authenticated" ON ebiomed.request_notifications;
DROP POLICY IF EXISTS "request_notification_read_state_update" ON ebiomed.request_notifications;
CREATE POLICY "request_notification_read_state_update" ON ebiomed.request_notifications
  FOR UPDATE USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "PM escalation notification read state updateable by authenticated" ON ebiomed.pm_escalation_notifications;
DROP POLICY IF EXISTS "PM escalation notification read state updateable by authenticat" ON ebiomed.pm_escalation_notifications;
DROP POLICY IF EXISTS "pm_escalation_notification_read_state_update" ON ebiomed.pm_escalation_notifications;
CREATE POLICY "pm_escalation_notification_read_state_update" ON ebiomed.pm_escalation_notifications
  FOR UPDATE USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
