-- Phase 3: Calibration & Traceability Engine (ISO 15189/17025)

-- 1. Add new equipment status values (safe: skips if already exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'ebiomed.equipment_status'::regtype AND enumlabel = 'out_of_tolerance') THEN
    ALTER TYPE ebiomed.equipment_status ADD VALUE 'out_of_tolerance';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'ebiomed.equipment_status'::regtype AND enumlabel = 'certified') THEN
    ALTER TYPE ebiomed.equipment_status ADD VALUE 'certified';
  END IF;
END;
$$;

-- 2. Add calibration profile fields to equipment
ALTER TABLE ebiomed.equipment
  ADD COLUMN IF NOT EXISTS calibration_interval_days integer,
  ADD COLUMN IF NOT EXISTS calibration_parameters jsonb,
  ADD COLUMN IF NOT EXISTS last_calibrated timestamptz,
  ADD COLUMN IF NOT EXISTS next_calibration_due timestamptz;

-- 3. Reference standards table (master instruments used for calibration)
CREATE TABLE ebiomed.reference_standards (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  serial_number text UNIQUE NOT NULL,
  name text NOT NULL,
  manufacturer text,
  model text,
  certificate_number text,
  certificate_expiry date NOT NULL,
  calibration_interval_days integer NOT NULL DEFAULT 365,
  location text,
  notes text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'retired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX idx_reference_standards_status ON ebiomed.reference_standards(status);
CREATE INDEX idx_reference_standards_expiry ON ebiomed.reference_standards(certificate_expiry);

-- 4. Calibration readings table (quantitative measurements)
CREATE TABLE ebiomed.calibration_readings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  equipment_id uuid NOT NULL REFERENCES ebiomed.equipment(id) ON DELETE CASCADE,
  reference_standard_id uuid REFERENCES ebiomed.reference_standards(id) ON DELETE SET NULL,
  parameter text NOT NULL,
  measured_value numeric NOT NULL,
  expected_value numeric NOT NULL,
  tolerance_min numeric NOT NULL,
  tolerance_max numeric NOT NULL,
  unit text,
  passed boolean NOT NULL DEFAULT true,
  notes text,
  work_order_id uuid REFERENCES ebiomed.work_orders(id) ON DELETE SET NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid NOT NULL REFERENCES ebiomed.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_calibration_readings_equipment ON ebiomed.calibration_readings(equipment_id, recorded_at DESC);
CREATE INDEX idx_calibration_readings_wo ON ebiomed.calibration_readings(work_order_id);

-- 5. Environmental readings table (temperature, humidity alongside calibrations)
CREATE TABLE ebiomed.environmental_readings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  equipment_id uuid REFERENCES ebiomed.equipment(id) ON DELETE CASCADE,
  calibration_reading_id uuid REFERENCES ebiomed.calibration_readings(id) ON DELETE CASCADE,
  temperature_celsius numeric,
  humidity_percent numeric,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid NOT NULL REFERENCES ebiomed.profiles(id)
);

CREATE INDEX idx_environmental_readings_equipment ON ebiomed.environmental_readings(equipment_id, recorded_at DESC);

-- RLS for reference_standards
ALTER TABLE ebiomed.reference_standards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reference standards viewable by authenticated" ON ebiomed.reference_standards
  FOR SELECT USING (auth.role() = 'authenticated' AND deleted_at IS NULL);

CREATE POLICY "Reference standards editable by admin or technician" ON ebiomed.reference_standards
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND EXISTS (SELECT 1 FROM ebiomed.profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
  );

-- RLS for calibration_readings
ALTER TABLE ebiomed.calibration_readings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Calibration readings viewable by authenticated" ON ebiomed.calibration_readings
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Calibration readings insertable by admin or technician" ON ebiomed.calibration_readings
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND EXISTS (SELECT 1 FROM ebiomed.profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
  );

-- RLS for environmental_readings
ALTER TABLE ebiomed.environmental_readings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Environmental readings viewable by authenticated" ON ebiomed.environmental_readings
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Environmental readings insertable by admin or technician" ON ebiomed.environmental_readings
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND EXISTS (SELECT 1 FROM ebiomed.profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
  );

-- Apply update_updated_at trigger to new tables
DROP TRIGGER IF EXISTS trg_reference_standards_updated_at ON ebiomed.reference_standards;
CREATE TRIGGER trg_reference_standards_updated_at
  BEFORE UPDATE ON ebiomed.reference_standards
  FOR EACH ROW EXECUTE FUNCTION ebiomed.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_calibration_readings_updated_at ON ebiomed.calibration_readings;
CREATE TRIGGER trg_calibration_readings_updated_at
  BEFORE UPDATE ON ebiomed.calibration_readings
  FOR EACH ROW EXECUTE FUNCTION ebiomed.update_updated_at_column();

-- Grant access
GRANT SELECT ON ebiomed.reference_standards TO anon, authenticated;
GRANT INSERT, UPDATE ON ebiomed.reference_standards TO authenticated;
GRANT SELECT ON ebiomed.calibration_readings TO authenticated;
GRANT INSERT ON ebiomed.calibration_readings TO authenticated;
GRANT SELECT ON ebiomed.environmental_readings TO authenticated;
GRANT INSERT ON ebiomed.environmental_readings TO authenticated;

-- Audit trigger on reference standards
DROP TRIGGER IF EXISTS trg_reference_standards_audit ON ebiomed.reference_standards;

CREATE OR REPLACE FUNCTION ebiomed.audit_reference_standards()
RETURNS TRIGGER AS $$
DECLARE
  audit_reason text;
BEGIN
  audit_reason := COALESCE(current_setting('app.reason', true), 'System operation');

  IF TG_OP = 'INSERT' THEN
    INSERT INTO ebiomed.audit_log (table_name, record_id, action, new_value, changed_by, reason)
    VALUES ('reference_standards', NEW.id, 'insert', to_jsonb(NEW)::text, auth.uid(), audit_reason);
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO ebiomed.audit_log (table_name, record_id, action, old_value, new_value, changed_by, reason)
    VALUES ('reference_standards', NEW.id, 'update', to_jsonb(OLD)::text, to_jsonb(NEW)::text, auth.uid(), audit_reason);
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO ebiomed.audit_log (table_name, record_id, action, old_value, changed_by, reason)
    VALUES ('reference_standards', OLD.id, 'delete', to_jsonb(OLD)::text, auth.uid(), audit_reason);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_reference_standards_audit
  AFTER INSERT OR UPDATE OR DELETE ON ebiomed.reference_standards
  FOR EACH ROW EXECUTE FUNCTION ebiomed.audit_reference_standards();
