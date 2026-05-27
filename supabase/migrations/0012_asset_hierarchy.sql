-- Phase 5: Asset Registry Maturation (FR-1.2, FR-1.3)

-- Parent-child asset hierarchy
ALTER TABLE ebiomed.equipment
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES ebiomed.equipment(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_equipment_parent ON ebiomed.equipment(parent_id);

-- GMDN / UDI nomenclature fields
ALTER TABLE ebiomed.equipment
  ADD COLUMN IF NOT EXISTS gmdn_code text,
  ADD COLUMN IF NOT EXISTS gmdn_term text,
  ADD COLUMN IF NOT EXISTS udi_di text,
  ADD COLUMN IF NOT EXISTS udi_pi text;
