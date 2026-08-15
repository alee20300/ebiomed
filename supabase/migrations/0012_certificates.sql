-- Phase 4: Certificate Generation & Asset Compliance

CREATE TABLE ebiomed.certificates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  equipment_id uuid NOT NULL REFERENCES ebiomed.equipment(id) ON DELETE CASCADE,
  certificate_number text UNIQUE NOT NULL,
  calibration_work_order_id uuid REFERENCES ebiomed.work_orders(id) ON DELETE SET NULL,
  audit_trail_hash text NOT NULL,
  pdf_url text,
  issued_by uuid NOT NULL REFERENCES ebiomed.profiles(id),
  issued_at timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'valid' CHECK (status IN ('valid', 'expired', 'revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_certificates_equipment ON ebiomed.certificates(equipment_id, issued_at DESC);
CREATE INDEX idx_certificates_number ON ebiomed.certificates(certificate_number);
CREATE INDEX idx_certificates_status ON ebiomed.certificates(status);
CREATE INDEX idx_certificates_valid_until ON ebiomed.certificates(valid_until);

ALTER TABLE ebiomed.certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Certificates viewable by authenticated" ON ebiomed.certificates
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Certificates insertable by admin or technician" ON ebiomed.certificates
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND EXISTS (SELECT 1 FROM ebiomed.profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
  );

DROP TRIGGER IF EXISTS trg_certificates_updated_at ON ebiomed.certificates;
CREATE TRIGGER trg_certificates_updated_at
  BEFORE UPDATE ON ebiomed.certificates
  FOR EACH ROW EXECUTE FUNCTION ebiomed.update_updated_at_column();

GRANT SELECT ON ebiomed.certificates TO authenticated;
GRANT INSERT ON ebiomed.certificates TO authenticated;
