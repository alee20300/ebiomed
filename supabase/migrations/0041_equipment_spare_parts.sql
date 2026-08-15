-- Explicit equipment-to-spare-part catalogue.

CREATE TABLE IF NOT EXISTS ebiomed.equipment_spare_parts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  equipment_id uuid NOT NULL REFERENCES ebiomed.equipment(id) ON DELETE CASCADE,
  part_id uuid NOT NULL REFERENCES ebiomed.parts(id) ON DELETE RESTRICT,
  relationship_type text NOT NULL DEFAULT 'compatible'
    CHECK (relationship_type IN ('compatible', 'recommended', 'critical')),
  recommended_quantity integer CHECK (recommended_quantity IS NULL OR recommended_quantity > 0),
  notes text,
  created_by uuid REFERENCES ebiomed.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (equipment_id, part_id)
);

CREATE INDEX IF NOT EXISTS idx_equipment_spare_parts_equipment
  ON ebiomed.equipment_spare_parts(equipment_id, relationship_type);

CREATE INDEX IF NOT EXISTS idx_equipment_spare_parts_part
  ON ebiomed.equipment_spare_parts(part_id);

DROP TRIGGER IF EXISTS trg_equipment_spare_parts_updated_at ON ebiomed.equipment_spare_parts;
CREATE TRIGGER trg_equipment_spare_parts_updated_at
  BEFORE UPDATE ON ebiomed.equipment_spare_parts
  FOR EACH ROW EXECUTE FUNCTION ebiomed.update_updated_at_column();

ALTER TABLE ebiomed.equipment_spare_parts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Equipment spare parts readable by authenticated" ON ebiomed.equipment_spare_parts;
CREATE POLICY "Equipment spare parts readable by authenticated" ON ebiomed.equipment_spare_parts
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Equipment spare parts writable by biomedical staff" ON ebiomed.equipment_spare_parts;
CREATE POLICY "Equipment spare parts writable by biomedical staff" ON ebiomed.equipment_spare_parts
  FOR ALL USING (
    auth.role() = 'authenticated' AND EXISTS (
      SELECT 1 FROM ebiomed.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'technician')
    )
  ) WITH CHECK (
    auth.role() = 'authenticated' AND EXISTS (
      SELECT 1 FROM ebiomed.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'technician')
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON ebiomed.equipment_spare_parts TO authenticated;
