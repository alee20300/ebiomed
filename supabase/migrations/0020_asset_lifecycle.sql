-- Phase 4: Asset lifecycle, risk, replacement planning, and documents

ALTER TABLE ebiomed.equipment
  ADD COLUMN IF NOT EXISTS acquisition_date date,
  ADD COLUMN IF NOT EXISTS purchase_cost numeric(12,2),
  ADD COLUMN IF NOT EXISTS expected_life_years numeric(5,2),
  ADD COLUMN IF NOT EXISTS residual_value numeric(12,2),
  ADD COLUMN IF NOT EXISTS current_value numeric(12,2),
  ADD COLUMN IF NOT EXISTS depreciation_method text NOT NULL DEFAULT 'straight_line'
    CHECK (depreciation_method IN ('straight_line', 'declining_balance', 'none')),
  ADD COLUMN IF NOT EXISTS replacement_target_date date,
  ADD COLUMN IF NOT EXISTS lifecycle_stage text NOT NULL DEFAULT 'in_service'
    CHECK (lifecycle_stage IN ('planning', 'procurement', 'commissioning', 'in_service', 'limited_support', 'end_of_life', 'retired')),
  ADD COLUMN IF NOT EXISTS patient_impact smallint NOT NULL DEFAULT 3 CHECK (patient_impact BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS downtime_impact smallint NOT NULL DEFAULT 3 CHECK (downtime_impact BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS utilization smallint NOT NULL DEFAULT 3 CHECK (utilization BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS regulatory_class smallint NOT NULL DEFAULT 3 CHECK (regulatory_class BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS maintenance_burden smallint NOT NULL DEFAULT 3 CHECK (maintenance_burden BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS support_expiry date;

CREATE INDEX IF NOT EXISTS idx_equipment_replacement_target
  ON ebiomed.equipment(replacement_target_date);

CREATE INDEX IF NOT EXISTS idx_equipment_lifecycle_stage
  ON ebiomed.equipment(lifecycle_stage);

CREATE TABLE IF NOT EXISTS ebiomed.asset_documents (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  equipment_id uuid NOT NULL REFERENCES ebiomed.equipment(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN ('manual', 'certificate', 'purchase_doc', 'photo', 'warranty_doc', 'other')),
  title text NOT NULL,
  file_url text NOT NULL,
  file_name text,
  mime_type text,
  expires_at date,
  uploaded_by uuid REFERENCES ebiomed.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asset_documents_equipment
  ON ebiomed.asset_documents(equipment_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_asset_documents_expiry
  ON ebiomed.asset_documents(expires_at)
  WHERE expires_at IS NOT NULL;

ALTER TABLE ebiomed.asset_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Asset documents viewable by authenticated" ON ebiomed.asset_documents;
CREATE POLICY "Asset documents viewable by authenticated" ON ebiomed.asset_documents
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Asset documents insertable by admin or technician" ON ebiomed.asset_documents;
CREATE POLICY "Asset documents insertable by admin or technician" ON ebiomed.asset_documents
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1
      FROM ebiomed.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'technician')
    )
  );

GRANT SELECT, INSERT ON ebiomed.asset_documents TO authenticated;

INSERT INTO storage.buckets (id, name, public)
VALUES ('asset-documents', 'asset-documents', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Asset document files readable by authenticated" ON storage.objects;
CREATE POLICY "Asset document files readable by authenticated" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'asset-documents' AND auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "Asset document files uploadable by admin or technician" ON storage.objects;
CREATE POLICY "Asset document files uploadable by admin or technician" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'asset-documents' AND
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1
      FROM ebiomed.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'technician')
    )
  );
