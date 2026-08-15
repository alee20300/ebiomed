-- Integration and import observability hardening.

ALTER TABLE ebiomed.import_batches
  ADD COLUMN IF NOT EXISTS source_hash text,
  ADD COLUMN IF NOT EXISTS committed_rows integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commit_summary jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS ebiomed.api_key_usage_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  api_key_id uuid REFERENCES ebiomed.api_keys(id) ON DELETE SET NULL,
  outcome text NOT NULL,
  resource text,
  scopes text[] NOT NULL DEFAULT ARRAY[]::text[],
  ip_address text,
  user_agent text,
  failure_reason text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  CHECK (outcome IN ('accepted', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_api_key_usage_key_time ON ebiomed.api_key_usage_events(api_key_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_key_usage_outcome_time ON ebiomed.api_key_usage_events(outcome, occurred_at DESC);

ALTER TABLE ebiomed.api_key_usage_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "API key usage admin readable" ON ebiomed.api_key_usage_events;
CREATE POLICY "API key usage admin readable" ON ebiomed.api_key_usage_events
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND EXISTS (SELECT 1 FROM ebiomed.profiles WHERE id = auth.uid() AND role = 'admin')
  );

GRANT SELECT, INSERT ON ebiomed.api_key_usage_events TO authenticated;
