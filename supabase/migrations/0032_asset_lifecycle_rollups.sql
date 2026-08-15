-- Phase 4 hardening: durable asset lifecycle rollups for EAM-grade querying

ALTER TABLE ebiomed.equipment
  ADD COLUMN IF NOT EXISTS lifecycle_risk_score integer CHECK (lifecycle_risk_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS lifecycle_risk_band text CHECK (lifecycle_risk_band IN ('Low', 'Moderate', 'High', 'Critical')),
  ADD COLUMN IF NOT EXISTS calculated_current_value numeric(12,2),
  ADD COLUMN IF NOT EXISTS service_cost_to_date numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS downtime_minutes_to_date integer NOT NULL DEFAULT 0 CHECK (downtime_minutes_to_date >= 0),
  ADD COLUMN IF NOT EXISTS replacement_recommendation text CHECK (replacement_recommendation IN ('monitor', 'plan', 'replace')),
  ADD COLUMN IF NOT EXISTS replacement_recommendation_label text,
  ADD COLUMN IF NOT EXISTS replacement_recommendation_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS lifecycle_reviewed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_equipment_lifecycle_risk
  ON ebiomed.equipment(lifecycle_risk_score DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_equipment_replacement_recommendation
  ON ebiomed.equipment(replacement_recommendation, replacement_target_date)
  WHERE replacement_recommendation IS NOT NULL;
