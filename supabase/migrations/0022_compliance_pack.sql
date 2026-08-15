-- Phase 6: Compliance Pack
-- Hardens regulated records and adds document retention metadata.

ALTER TABLE ebiomed.signatures
  ADD COLUMN IF NOT EXISTS reason text;

UPDATE ebiomed.signatures
SET reason = 'Legacy signature recorded before reason enforcement'
WHERE reason IS NULL;

ALTER TABLE ebiomed.signatures
  ALTER COLUMN reason SET NOT NULL;

ALTER TABLE ebiomed.asset_documents
  ADD COLUMN IF NOT EXISTS retention_policy text NOT NULL DEFAULT 'standard_7_years',
  ADD COLUMN IF NOT EXISTS retain_until date,
  ADD COLUMN IF NOT EXISTS legal_hold boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS legal_hold_reason text;

ALTER TABLE ebiomed.asset_documents
  ADD CONSTRAINT asset_documents_legal_hold_reason_required
  CHECK (legal_hold = false OR NULLIF(btrim(COALESCE(legal_hold_reason, '')), '') IS NOT NULL) NOT VALID;

CREATE INDEX IF NOT EXISTS idx_asset_documents_retention
  ON ebiomed.asset_documents(retain_until)
  WHERE retain_until IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_asset_documents_legal_hold
  ON ebiomed.asset_documents(legal_hold)
  WHERE legal_hold = true;

CREATE TABLE IF NOT EXISTS ebiomed.certificate_revocations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  certificate_id uuid NOT NULL REFERENCES ebiomed.certificates(id) ON DELETE RESTRICT,
  revoked_by uuid NOT NULL REFERENCES ebiomed.profiles(id),
  revoked_at timestamptz NOT NULL DEFAULT now(),
  reason text NOT NULL,
  UNIQUE (certificate_id)
);

CREATE INDEX IF NOT EXISTS idx_certificate_revocations_certificate
  ON ebiomed.certificate_revocations(certificate_id);

ALTER TABLE ebiomed.certificate_revocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Certificate revocations viewable by authenticated" ON ebiomed.certificate_revocations;
CREATE POLICY "Certificate revocations viewable by authenticated" ON ebiomed.certificate_revocations
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Certificate revocations insertable by admin or technician" ON ebiomed.certificate_revocations;
CREATE POLICY "Certificate revocations insertable by admin or technician" ON ebiomed.certificate_revocations
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND revoked_by = auth.uid()
    AND EXISTS (SELECT 1 FROM ebiomed.profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
  );

GRANT SELECT, INSERT ON ebiomed.certificate_revocations TO authenticated;

CREATE OR REPLACE FUNCTION ebiomed.deny_immutable_row_change()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Immutable compliance rows cannot be updated or deleted';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_log_immutable_update ON ebiomed.audit_log;
CREATE TRIGGER trg_audit_log_immutable_update
  BEFORE UPDATE ON ebiomed.audit_log
  FOR EACH ROW EXECUTE FUNCTION ebiomed.deny_immutable_row_change();

DROP TRIGGER IF EXISTS trg_audit_log_immutable_delete ON ebiomed.audit_log;
CREATE TRIGGER trg_audit_log_immutable_delete
  BEFORE DELETE ON ebiomed.audit_log
  FOR EACH ROW EXECUTE FUNCTION ebiomed.deny_immutable_row_change();

DROP TRIGGER IF EXISTS trg_signatures_immutable_update ON ebiomed.signatures;
CREATE TRIGGER trg_signatures_immutable_update
  BEFORE UPDATE ON ebiomed.signatures
  FOR EACH ROW EXECUTE FUNCTION ebiomed.deny_immutable_row_change();

DROP TRIGGER IF EXISTS trg_signatures_immutable_delete ON ebiomed.signatures;
CREATE TRIGGER trg_signatures_immutable_delete
  BEFORE DELETE ON ebiomed.signatures
  FOR EACH ROW EXECUTE FUNCTION ebiomed.deny_immutable_row_change();

DROP TRIGGER IF EXISTS trg_certificates_immutable_update ON ebiomed.certificates;
CREATE TRIGGER trg_certificates_immutable_update
  BEFORE UPDATE ON ebiomed.certificates
  FOR EACH ROW EXECUTE FUNCTION ebiomed.deny_immutable_row_change();

DROP TRIGGER IF EXISTS trg_certificates_immutable_delete ON ebiomed.certificates;
CREATE TRIGGER trg_certificates_immutable_delete
  BEFORE DELETE ON ebiomed.certificates
  FOR EACH ROW EXECUTE FUNCTION ebiomed.deny_immutable_row_change();

DROP TRIGGER IF EXISTS trg_certificate_revocations_immutable_update ON ebiomed.certificate_revocations;
CREATE TRIGGER trg_certificate_revocations_immutable_update
  BEFORE UPDATE ON ebiomed.certificate_revocations
  FOR EACH ROW EXECUTE FUNCTION ebiomed.deny_immutable_row_change();

DROP TRIGGER IF EXISTS trg_certificate_revocations_immutable_delete ON ebiomed.certificate_revocations;
CREATE TRIGGER trg_certificate_revocations_immutable_delete
  BEFORE DELETE ON ebiomed.certificate_revocations
  FOR EACH ROW EXECUTE FUNCTION ebiomed.deny_immutable_row_change();

DROP POLICY IF EXISTS "Signatures insertable by authenticated" ON ebiomed.signatures;
REVOKE INSERT, UPDATE, DELETE ON ebiomed.signatures FROM authenticated;
GRANT SELECT ON ebiomed.signatures TO authenticated;

CREATE OR REPLACE FUNCTION ebiomed.insert_signature_entry(
  p_record_type text,
  p_record_id uuid,
  p_meaning ebiomed.signature_meaning,
  p_reason text,
  p_signature_hash text DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  signature_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authenticated user required';
  END IF;

  IF NULLIF(btrim(COALESCE(p_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Signature reason is required';
  END IF;

  INSERT INTO ebiomed.signatures (
    signer_id,
    record_type,
    record_id,
    meaning,
    reason,
    signature_hash
  )
  VALUES (
    auth.uid(),
    p_record_type,
    p_record_id,
    p_meaning,
    p_reason,
    p_signature_hash
  )
  RETURNING id INTO signature_id;

  RETURN signature_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION ebiomed.insert_signature_entry(text, uuid, ebiomed.signature_meaning, text, text) TO authenticated;

DROP POLICY IF EXISTS "Certificates insertable by admin or technician" ON ebiomed.certificates;
REVOKE UPDATE, DELETE ON ebiomed.certificates FROM authenticated;

CREATE POLICY "Certificates insertable by admin or technician" ON ebiomed.certificates
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND issued_by = auth.uid()
    AND EXISTS (SELECT 1 FROM ebiomed.profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
  );
