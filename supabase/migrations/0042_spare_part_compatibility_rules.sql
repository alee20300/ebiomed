-- Reusable spare-part compatibility rules inherited by matching equipment.

CREATE TABLE IF NOT EXISTS ebiomed.spare_part_compatibility_rules (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  part_id uuid NOT NULL REFERENCES ebiomed.parts(id) ON DELETE RESTRICT,
  scope_type text NOT NULL CHECK (scope_type IN ('model', 'manufacturer', 'category', 'universal')),
  manufacturer text,
  model text,
  device_category text,
  relationship_type text NOT NULL DEFAULT 'compatible'
    CHECK (relationship_type IN ('compatible', 'recommended', 'critical')),
  recommended_quantity integer CHECK (recommended_quantity IS NULL OR recommended_quantity > 0),
  notes text,
  created_by uuid REFERENCES ebiomed.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (scope_type = 'model' AND manufacturer IS NOT NULL AND model IS NOT NULL) OR
    (scope_type = 'manufacturer' AND manufacturer IS NOT NULL AND model IS NULL AND device_category IS NULL) OR
    (scope_type = 'category' AND device_category IS NOT NULL AND manufacturer IS NULL AND model IS NULL) OR
    (scope_type = 'universal' AND manufacturer IS NULL AND model IS NULL AND device_category IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_spare_part_compatibility_unique
  ON ebiomed.spare_part_compatibility_rules (
    part_id,
    scope_type,
    lower(COALESCE(manufacturer, '')),
    lower(COALESCE(model, '')),
    lower(COALESCE(device_category, ''))
  );

CREATE INDEX IF NOT EXISTS idx_spare_part_compatibility_model
  ON ebiomed.spare_part_compatibility_rules(lower(manufacturer), lower(model))
  WHERE scope_type = 'model';

CREATE INDEX IF NOT EXISTS idx_spare_part_compatibility_category
  ON ebiomed.spare_part_compatibility_rules(lower(device_category))
  WHERE scope_type = 'category';

DROP TRIGGER IF EXISTS trg_spare_part_compatibility_updated_at ON ebiomed.spare_part_compatibility_rules;
CREATE TRIGGER trg_spare_part_compatibility_updated_at
  BEFORE UPDATE ON ebiomed.spare_part_compatibility_rules
  FOR EACH ROW EXECUTE FUNCTION ebiomed.update_updated_at_column();

ALTER TABLE ebiomed.spare_part_compatibility_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Spare compatibility readable by authenticated" ON ebiomed.spare_part_compatibility_rules;
CREATE POLICY "Spare compatibility readable by authenticated" ON ebiomed.spare_part_compatibility_rules
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Spare compatibility writable by biomedical staff" ON ebiomed.spare_part_compatibility_rules;
CREATE POLICY "Spare compatibility writable by biomedical staff" ON ebiomed.spare_part_compatibility_rules
  FOR ALL USING (
    auth.role() = 'authenticated' AND EXISTS (
      SELECT 1 FROM ebiomed.profiles WHERE id = auth.uid() AND role IN ('admin', 'technician')
    )
  ) WITH CHECK (
    auth.role() = 'authenticated' AND EXISTS (
      SELECT 1 FROM ebiomed.profiles WHERE id = auth.uid() AND role IN ('admin', 'technician')
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON ebiomed.spare_part_compatibility_rules TO authenticated;
