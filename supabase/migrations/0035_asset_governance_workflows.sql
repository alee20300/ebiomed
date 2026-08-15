-- Enterprise asset governance: cybersecurity, commissioning, and decommissioning workflows.

ALTER TABLE ebiomed.equipment
  ADD COLUMN IF NOT EXISTS os_platform text,
  ADD COLUMN IF NOT EXISTS network_zone text,
  ADD COLUMN IF NOT EXISTS patch_status text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS antivirus_status text NOT NULL DEFAULT 'not_applicable',
  ADD COLUMN IF NOT EXISTS backup_status text NOT NULL DEFAULT 'not_applicable',
  ADD COLUMN IF NOT EXISTS internet_exposed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS remote_access_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cybersecurity_owner uuid REFERENCES ebiomed.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS risk_acceptance_status text NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS risk_acceptance_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS commissioning_status text NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS commissioning_approved_by uuid REFERENCES ebiomed.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS commissioning_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS decommissioning_status text NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS decommissioned_by uuid REFERENCES ebiomed.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS decommissioned_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'equipment_patch_status_valid') THEN
    ALTER TABLE ebiomed.equipment
      ADD CONSTRAINT equipment_patch_status_valid
      CHECK (patch_status IN ('unknown', 'current', 'due', 'overdue', 'unsupported', 'risk_accepted')) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'equipment_antivirus_status_valid') THEN
    ALTER TABLE ebiomed.equipment
      ADD CONSTRAINT equipment_antivirus_status_valid
      CHECK (antivirus_status IN ('not_applicable', 'enabled', 'disabled', 'outdated', 'unsupported')) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'equipment_backup_status_valid') THEN
    ALTER TABLE ebiomed.equipment
      ADD CONSTRAINT equipment_backup_status_valid
      CHECK (backup_status IN ('not_applicable', 'current', 'stale', 'missing', 'failed')) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'equipment_risk_acceptance_status_valid') THEN
    ALTER TABLE ebiomed.equipment
      ADD CONSTRAINT equipment_risk_acceptance_status_valid
      CHECK (risk_acceptance_status IN ('not_required', 'pending', 'accepted', 'expired', 'rejected')) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'equipment_commissioning_status_valid') THEN
    ALTER TABLE ebiomed.equipment
      ADD CONSTRAINT equipment_commissioning_status_valid
      CHECK (commissioning_status IN ('not_required', 'pending_installation', 'installed', 'acceptance_testing', 'user_training', 'approved_for_service', 'rejected')) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'equipment_decommissioning_status_valid') THEN
    ALTER TABLE ebiomed.equipment
      ADD CONSTRAINT equipment_decommissioning_status_valid
      CHECK (decommissioning_status IN ('not_started', 'requested', 'in_progress', 'completed', 'rejected')) NOT VALID;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS ebiomed.cybersecurity_assessments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  equipment_id uuid NOT NULL REFERENCES ebiomed.equipment(id) ON DELETE CASCADE,
  assessment_status text NOT NULL CHECK (assessment_status IN ('pass', 'monitor', 'risk_acceptance_required', 'fail')),
  patch_status text NOT NULL CHECK (patch_status IN ('unknown', 'current', 'due', 'overdue', 'unsupported', 'risk_accepted')),
  antivirus_status text NOT NULL CHECK (antivirus_status IN ('not_applicable', 'enabled', 'disabled', 'outdated', 'unsupported')),
  backup_status text NOT NULL CHECK (backup_status IN ('not_applicable', 'current', 'stale', 'missing', 'failed')),
  internet_exposed boolean NOT NULL DEFAULT false,
  remote_access_enabled boolean NOT NULL DEFAULT false,
  vulnerabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  assessment_notes text NOT NULL,
  risk_acceptance_reason text,
  risk_acceptance_expires_at timestamptz,
  assessed_by uuid NOT NULL REFERENCES ebiomed.profiles(id),
  assessed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ebiomed.commissioning_records (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  equipment_id uuid NOT NULL REFERENCES ebiomed.equipment(id) ON DELETE CASCADE,
  commissioning_status text NOT NULL CHECK (commissioning_status IN ('pending_installation', 'installed', 'acceptance_testing', 'user_training', 'approved_for_service', 'rejected')),
  installation_verified boolean NOT NULL DEFAULT false,
  acceptance_test_passed boolean NOT NULL DEFAULT false,
  user_training_completed boolean NOT NULL DEFAULT false,
  handover_completed boolean NOT NULL DEFAULT false,
  evidence_notes text NOT NULL,
  approved_by uuid REFERENCES ebiomed.profiles(id),
  approved_at timestamptz,
  created_by uuid NOT NULL REFERENCES ebiomed.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ebiomed.decommissioning_records (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  equipment_id uuid NOT NULL REFERENCES ebiomed.equipment(id) ON DELETE CASCADE,
  disposal_method text NOT NULL,
  data_sanitization_status text NOT NULL CHECK (data_sanitization_status IN ('not_applicable', 'pending', 'completed', 'failed')),
  accessories_recovered boolean NOT NULL DEFAULT false,
  hazardous_material_checked boolean NOT NULL DEFAULT false,
  finance_approval_reference text,
  final_location text,
  certificate_url text,
  evidence_notes text NOT NULL,
  completed_by uuid NOT NULL REFERENCES ebiomed.profiles(id),
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cybersecurity_assessments_equipment
  ON ebiomed.cybersecurity_assessments(equipment_id, assessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_commissioning_records_equipment
  ON ebiomed.commissioning_records(equipment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_decommissioning_records_equipment
  ON ebiomed.decommissioning_records(equipment_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_equipment_cybersecurity_dashboard
  ON ebiomed.equipment(network_connected, patch_status, risk_acceptance_status)
  WHERE network_connected = true;

ALTER TABLE ebiomed.cybersecurity_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ebiomed.commissioning_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE ebiomed.decommissioning_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cybersecurity assessments viewable by authenticated" ON ebiomed.cybersecurity_assessments
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Cybersecurity assessments insertable by biomedical staff" ON ebiomed.cybersecurity_assessments
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND
    EXISTS (SELECT 1 FROM ebiomed.profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
  );

CREATE POLICY "Commissioning records viewable by authenticated" ON ebiomed.commissioning_records
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Commissioning records insertable by biomedical staff" ON ebiomed.commissioning_records
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND
    EXISTS (SELECT 1 FROM ebiomed.profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
  );

CREATE POLICY "Decommissioning records viewable by authenticated" ON ebiomed.decommissioning_records
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Decommissioning records insertable by biomedical staff" ON ebiomed.decommissioning_records
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND
    EXISTS (SELECT 1 FROM ebiomed.profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
  );

GRANT SELECT, INSERT ON ebiomed.cybersecurity_assessments TO authenticated;
GRANT SELECT, INSERT ON ebiomed.commissioning_records TO authenticated;
GRANT SELECT, INSERT ON ebiomed.decommissioning_records TO authenticated;
