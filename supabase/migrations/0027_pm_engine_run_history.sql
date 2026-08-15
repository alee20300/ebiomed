-- PM engine observability for scheduled cron runs and manual diagnostics.

CREATE TABLE IF NOT EXISTS ebiomed.pm_engine_runs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  started_at timestamptz NOT NULL,
  finished_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL CHECK (status IN ('success', 'partial_failure', 'failed')),
  checked_schedules integer NOT NULL DEFAULT 0,
  created_occurrences integer NOT NULL DEFAULT 0,
  processed_occurrences integer NOT NULL DEFAULT 0,
  generated_work_orders integer NOT NULL DEFAULT 0,
  escalations integer NOT NULL DEFAULT 0,
  missed_occurrences integer NOT NULL DEFAULT 0,
  failures integer NOT NULL DEFAULT 0,
  failure_details jsonb NOT NULL DEFAULT '[]'::jsonb,
  triggered_by text NOT NULL DEFAULT 'cron',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pm_engine_runs_started
  ON ebiomed.pm_engine_runs(started_at DESC);

ALTER TABLE ebiomed.pm_engine_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "PM engine runs viewable by admin technician" ON ebiomed.pm_engine_runs;
CREATE POLICY "PM engine runs viewable by admin technician" ON ebiomed.pm_engine_runs
  FOR SELECT USING (
    auth.role() = 'authenticated' AND
    EXISTS (SELECT 1 FROM ebiomed.profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
  );

DROP POLICY IF EXISTS "PM engine runs insertable by service or admin" ON ebiomed.pm_engine_runs;
CREATE POLICY "PM engine runs insertable by service or admin" ON ebiomed.pm_engine_runs
  FOR INSERT WITH CHECK (
    auth.role() = 'service_role' OR
    EXISTS (SELECT 1 FROM ebiomed.profiles WHERE id = auth.uid() AND role = 'admin')
  );

GRANT SELECT ON ebiomed.pm_engine_runs TO authenticated;
GRANT INSERT ON ebiomed.pm_engine_runs TO authenticated, service_role;
