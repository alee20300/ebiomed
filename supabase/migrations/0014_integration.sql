-- Phase 6: Integration & Advanced Features (PRD Phase 2)

-- Usage-based PM trigger fields
ALTER TABLE ebiomed.equipment
  ADD COLUMN IF NOT EXISTS run_hours numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cycle_count integer DEFAULT 0;

-- PM trigger type and threshold
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pm_trigger_type' AND typnamespace = 'ebiomed'::regnamespace) THEN
    CREATE TYPE ebiomed.pm_trigger_type AS ENUM (
      'calendar', 'run_hours', 'cycles', 'calendar_or_usage', 'calendar_and_usage'
    );
  END IF;
END;
$$;

ALTER TABLE ebiomed.equipment
  ADD COLUMN IF NOT EXISTS pm_trigger_type ebiomed.pm_trigger_type DEFAULT 'calendar',
  ADD COLUMN IF NOT EXISTS pm_trigger_value numeric;

-- API keys table for external system integration
CREATE TABLE ebiomed.api_keys (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  key_hash text UNIQUE NOT NULL,
  created_by uuid NOT NULL REFERENCES ebiomed.profiles(id),
  expires_at timestamptz,
  last_used_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ebiomed.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "API keys viewable by admin" ON ebiomed.api_keys
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND EXISTS (SELECT 1 FROM ebiomed.profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP TRIGGER IF EXISTS trg_api_keys_updated_at ON ebiomed.api_keys;
CREATE TRIGGER trg_api_keys_updated_at
  BEFORE UPDATE ON ebiomed.api_keys
  FOR EACH ROW EXECUTE FUNCTION ebiomed.update_updated_at_column();

GRANT SELECT ON ebiomed.api_keys TO authenticated;
