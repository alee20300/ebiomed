-- Standardize call-log outcomes for the on-call biomedical engineer workflow.

UPDATE ebiomed.complaints
SET call_status = CASE call_status
  WHEN 'answered' THEN 'informed'
  WHEN 'unanswered' THEN 'not_picked'
  ELSE call_status
END
WHERE call_status IN ('answered', 'unanswered');

ALTER TABLE ebiomed.complaints
  DROP CONSTRAINT IF EXISTS complaints_call_status_check;

ALTER TABLE ebiomed.complaints
  ADD CONSTRAINT complaints_call_status_check
  CHECK (call_status IS NULL OR call_status IN ('informed', 'not_picked', 'not_called'));

INSERT INTO ebiomed.app_settings (key, value)
VALUES ('call_log_workflow_enabled', 'true'::jsonb)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();
