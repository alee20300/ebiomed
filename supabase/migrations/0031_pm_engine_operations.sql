-- Phase 3 hardening: PM occurrence operational controls and policy validation

ALTER TABLE ebiomed.pm_occurrences
  ADD COLUMN IF NOT EXISTS skipped_at timestamptz,
  ADD COLUMN IF NOT EXISTS skipped_by uuid REFERENCES ebiomed.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS skip_reason text;

ALTER TABLE ebiomed.pm_schedules
  DROP CONSTRAINT IF EXISTS pm_schedules_escalation_policy_order,
  ADD CONSTRAINT pm_schedules_escalation_policy_order CHECK (
    COALESCE((escalation_policy->>'assignee_after_days')::integer, 0) <= COALESCE((escalation_policy->>'admin_after_days')::integer, 2)
    AND COALESCE((escalation_policy->>'admin_after_days')::integer, 2) <= COALESCE((escalation_policy->>'department_after_days')::integer, 5)
  ) NOT VALID;

CREATE INDEX IF NOT EXISTS idx_pm_occurrences_skipped
  ON ebiomed.pm_occurrences(skipped_at DESC)
  WHERE status = 'skipped';
