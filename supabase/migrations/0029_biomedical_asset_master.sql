-- Phase 1: Biomedical asset master fields for clinical engineering workflows.

ALTER TABLE ebiomed.equipment
  ADD COLUMN IF NOT EXISTS device_category text,
  ADD COLUMN IF NOT EXISTS asset_criticality text NOT NULL DEFAULT 'medium'
    CHECK (asset_criticality IN ('low', 'medium', 'high', 'life_support')),
  ADD COLUMN IF NOT EXISTS risk_class text NOT NULL DEFAULT 'class_ii'
    CHECK (risk_class IN ('class_i', 'class_ii', 'class_iii', 'not_applicable')),
  ADD COLUMN IF NOT EXISTS ownership_type text NOT NULL DEFAULT 'owned'
    CHECK (ownership_type IN ('owned', 'leased', 'rental', 'loaner', 'demo', 'vendor_owned')),
  ADD COLUMN IF NOT EXISTS cost_center text,
  ADD COLUMN IF NOT EXISTS clinical_area text,
  ADD COLUMN IF NOT EXISTS manufacturer_device_id text,
  ADD COLUMN IF NOT EXISTS software_version text,
  ADD COLUMN IF NOT EXISTS firmware_version text,
  ADD COLUMN IF NOT EXISTS network_connected boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ip_address inet,
  ADD COLUMN IF NOT EXISTS mac_address text,
  ADD COLUMN IF NOT EXISTS commissioned_at date,
  ADD COLUMN IF NOT EXISTS acceptance_test_date date,
  ADD COLUMN IF NOT EXISTS replacement_due_date date,
  ADD COLUMN IF NOT EXISTS retirement_reason text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'equipment_network_identity_required') THEN
    ALTER TABLE ebiomed.equipment
      ADD CONSTRAINT equipment_network_identity_required
      CHECK (
        network_connected = false OR ip_address IS NOT NULL OR NULLIF(BTRIM(mac_address), '') IS NOT NULL
      ) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'equipment_retirement_reason_required') THEN
    ALTER TABLE ebiomed.equipment
      ADD CONSTRAINT equipment_retirement_reason_required
      CHECK (
        lifecycle_stage <> 'retired' OR NULLIF(BTRIM(retirement_reason), '') IS NOT NULL
      ) NOT VALID;
  END IF;
END;
$$;

UPDATE ebiomed.equipment
SET
  device_category = COALESCE(device_category, category),
  clinical_area = COALESCE(clinical_area, department),
  replacement_due_date = COALESCE(replacement_due_date, replacement_target_date),
  asset_criticality = CASE
    WHEN LOWER(COALESCE(category, '')) IN ('ventilator', 'anesthesia', 'defibrillator') THEN 'life_support'
    WHEN LOWER(COALESCE(department, '')) IN ('icu', 'er', 'or') THEN 'high'
    ELSE asset_criticality
  END
WHERE device_category IS NULL
   OR clinical_area IS NULL
   OR replacement_due_date IS NULL
   OR asset_criticality = 'medium';

CREATE INDEX IF NOT EXISTS idx_equipment_asset_criticality
  ON ebiomed.equipment(asset_criticality);

CREATE INDEX IF NOT EXISTS idx_equipment_risk_class
  ON ebiomed.equipment(risk_class);

CREATE INDEX IF NOT EXISTS idx_equipment_cost_center
  ON ebiomed.equipment(cost_center)
  WHERE cost_center IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_equipment_network_connected
  ON ebiomed.equipment(network_connected)
  WHERE network_connected = true;

CREATE INDEX IF NOT EXISTS idx_equipment_replacement_due
  ON ebiomed.equipment(replacement_due_date)
  WHERE replacement_due_date IS NOT NULL;
