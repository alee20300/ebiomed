-- Phase: Call Log & Engineer Visit Tracking
-- Adds call-log fields to complaints + visit_logs table + app_settings seed

-- ============================================================
-- 1. Add call-log columns to complaints
-- ============================================================
ALTER TABLE ebiomed.complaints ADD COLUMN IF NOT EXISTS called_department boolean;
ALTER TABLE ebiomed.complaints ADD COLUMN IF NOT EXISTS answered_by text;
ALTER TABLE ebiomed.complaints ADD COLUMN IF NOT EXISTS call_status text;

-- ============================================================
-- 2. visit_logs table
-- ============================================================
CREATE TABLE IF NOT EXISTS ebiomed.visit_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  complaint_id uuid NOT NULL REFERENCES ebiomed.complaints(id) ON DELETE RESTRICT,
  visited_by uuid NOT NULL REFERENCES ebiomed.profiles(id),
  visited_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 3. RLS for visit_logs
-- ============================================================
ALTER TABLE ebiomed.visit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Visit logs viewable by authenticated" ON ebiomed.visit_logs;
CREATE POLICY "Visit logs viewable by authenticated" ON ebiomed.visit_logs
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Visit logs insertable by admin or technician" ON ebiomed.visit_logs;
CREATE POLICY "Visit logs insertable by admin or technician" ON ebiomed.visit_logs
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND
    EXISTS (SELECT 1 FROM ebiomed.profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
  );

-- ============================================================
-- 4. Seed feature toggle
-- ============================================================
INSERT INTO ebiomed.app_settings (key, value) VALUES ('call_log_workflow_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 5. Grant permissions
-- ============================================================
GRANT SELECT, INSERT ON ebiomed.visit_logs TO authenticated;
