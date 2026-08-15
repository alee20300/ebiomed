-- Phase 3: Advanced PM Engine
-- PM schedules now define trigger rules. PM compliance is tracked against due occurrences.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pm_occurrence_status' AND typnamespace = 'ebiomed'::regnamespace) THEN
    CREATE TYPE ebiomed.pm_occurrence_status AS ENUM ('due', 'generated', 'completed', 'missed', 'skipped');
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pm_escalation_level' AND typnamespace = 'ebiomed'::regnamespace) THEN
    CREATE TYPE ebiomed.pm_escalation_level AS ENUM ('none', 'assignee', 'admin', 'department');
  END IF;
END;
$$;

ALTER TABLE ebiomed.pm_schedules
  ADD COLUMN IF NOT EXISTS trigger_type ebiomed.pm_trigger_type NOT NULL DEFAULT 'calendar',
  ADD COLUMN IF NOT EXISTS calendar_interval_days integer,
  ADD COLUMN IF NOT EXISTS meter_interval numeric,
  ADD COLUMN IF NOT EXISTS cycle_interval integer,
  ADD COLUMN IF NOT EXISTS risk_modifier numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS grace_period_days integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS escalation_policy jsonb NOT NULL DEFAULT '{"assignee_after_days":0,"admin_after_days":2,"department_after_days":5}'::jsonb;

UPDATE ebiomed.pm_schedules
SET calendar_interval_days = COALESCE(calendar_interval_days, frequency_days)
WHERE calendar_interval_days IS NULL;

ALTER TABLE ebiomed.pm_schedules
  ADD CONSTRAINT pm_schedules_calendar_interval_positive CHECK (calendar_interval_days IS NULL OR calendar_interval_days > 0) NOT VALID,
  ADD CONSTRAINT pm_schedules_meter_interval_positive CHECK (meter_interval IS NULL OR meter_interval > 0) NOT VALID,
  ADD CONSTRAINT pm_schedules_cycle_interval_positive CHECK (cycle_interval IS NULL OR cycle_interval > 0) NOT VALID,
  ADD CONSTRAINT pm_schedules_risk_modifier_positive CHECK (risk_modifier > 0) NOT VALID,
  ADD CONSTRAINT pm_schedules_grace_period_non_negative CHECK (grace_period_days >= 0) NOT VALID;

CREATE TABLE IF NOT EXISTS ebiomed.pm_occurrences (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  pm_schedule_id uuid NOT NULL REFERENCES ebiomed.pm_schedules(id) ON DELETE CASCADE,
  equipment_id uuid NOT NULL REFERENCES ebiomed.equipment(id) ON DELETE CASCADE,
  due_at timestamptz NOT NULL,
  trigger_type ebiomed.pm_trigger_type NOT NULL,
  due_meter numeric,
  due_cycle integer,
  status ebiomed.pm_occurrence_status NOT NULL DEFAULT 'due',
  work_order_id uuid REFERENCES ebiomed.work_orders(id) ON DELETE SET NULL,
  generated_at timestamptz,
  completed_at timestamptz,
  missed_at timestamptz,
  escalation_level ebiomed.pm_escalation_level NOT NULL DEFAULT 'none',
  last_escalated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ebiomed.pm_escalation_notifications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  pm_occurrence_id uuid NOT NULL REFERENCES ebiomed.pm_occurrences(id) ON DELETE CASCADE,
  pm_schedule_id uuid NOT NULL REFERENCES ebiomed.pm_schedules(id) ON DELETE CASCADE,
  equipment_id uuid NOT NULL REFERENCES ebiomed.equipment(id) ON DELETE CASCADE,
  escalation_level ebiomed.pm_escalation_level NOT NULL,
  recipient_type text NOT NULL CHECK (recipient_type IN ('assignee', 'admin', 'department')),
  recipient_user_id uuid REFERENCES ebiomed.profiles(id) ON DELETE SET NULL,
  recipient_department text,
  message text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ebiomed.work_orders
  ADD COLUMN IF NOT EXISTS pm_schedule_id uuid REFERENCES ebiomed.pm_schedules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pm_occurrence_id uuid REFERENCES ebiomed.pm_occurrences(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pm_occurrences_schedule_due_unique
  ON ebiomed.pm_occurrences(pm_schedule_id, due_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pm_occurrences_work_order_unique
  ON ebiomed.pm_occurrences(work_order_id)
  WHERE work_order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_work_orders_pm_occurrence_unique
  ON ebiomed.work_orders(pm_occurrence_id)
  WHERE pm_occurrence_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_work_orders_one_open_pm_per_schedule
  ON ebiomed.work_orders(pm_schedule_id)
  WHERE type = 'preventive'
    AND pm_schedule_id IS NOT NULL
    AND status IN ('open', 'in_progress', 'on_hold');

CREATE INDEX IF NOT EXISTS idx_pm_occurrences_status_due
  ON ebiomed.pm_occurrences(status, due_at);

CREATE INDEX IF NOT EXISTS idx_pm_occurrences_equipment
  ON ebiomed.pm_occurrences(equipment_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pm_escalation_notifications_once
  ON ebiomed.pm_escalation_notifications(pm_occurrence_id, escalation_level, recipient_type);

CREATE INDEX IF NOT EXISTS idx_pm_escalation_notifications_occurrence
  ON ebiomed.pm_escalation_notifications(pm_occurrence_id, sent_at DESC);

DROP TRIGGER IF EXISTS trg_pm_occurrences_updated_at ON ebiomed.pm_occurrences;
CREATE TRIGGER trg_pm_occurrences_updated_at
  BEFORE UPDATE ON ebiomed.pm_occurrences
  FOR EACH ROW EXECUTE FUNCTION ebiomed.update_updated_at_column();

ALTER TABLE ebiomed.pm_occurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE ebiomed.pm_escalation_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "PM occurrences viewable by authenticated" ON ebiomed.pm_occurrences;
CREATE POLICY "PM occurrences viewable by authenticated" ON ebiomed.pm_occurrences
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "PM occurrences manageable by admin or technician" ON ebiomed.pm_occurrences;
CREATE POLICY "PM occurrences manageable by admin or technician" ON ebiomed.pm_occurrences
  FOR ALL USING (
    auth.role() = 'authenticated' AND
    EXISTS (SELECT 1 FROM ebiomed.profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
  );

DROP POLICY IF EXISTS "PM escalation notifications viewable by authenticated" ON ebiomed.pm_escalation_notifications;
CREATE POLICY "PM escalation notifications viewable by authenticated" ON ebiomed.pm_escalation_notifications
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "PM escalation notifications manageable by admin or technician" ON ebiomed.pm_escalation_notifications;
CREATE POLICY "PM escalation notifications manageable by admin or technician" ON ebiomed.pm_escalation_notifications
  FOR ALL USING (
    auth.role() = 'authenticated' AND
    EXISTS (SELECT 1 FROM ebiomed.profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
  );

GRANT SELECT, INSERT, UPDATE ON ebiomed.pm_occurrences TO authenticated;
GRANT SELECT, INSERT ON ebiomed.pm_escalation_notifications TO authenticated;
