-- Phase 2: Digital Signatures & Authentication (FDA 21 CFR Part 11)
-- Tracks signature events with cryptographic attestation

CREATE TYPE ebiomed.signature_meaning AS ENUM ('Verified', 'Calibrated', 'Approved', 'Reviewed');

CREATE TABLE ebiomed.signatures (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  signer_id uuid NOT NULL REFERENCES ebiomed.profiles(id) ON DELETE CASCADE,
  record_type text NOT NULL,
  record_id uuid NOT NULL,
  meaning ebiomed.signature_meaning NOT NULL,
  signed_at timestamptz NOT NULL DEFAULT now(),
  signature_hash text
);

CREATE INDEX idx_signatures_signer ON ebiomed.signatures(signer_id);
CREATE INDEX idx_signatures_record ON ebiomed.signatures(record_type, record_id);
CREATE INDEX idx_signatures_signed_at ON ebiomed.signatures(signed_at DESC);

ALTER TABLE ebiomed.signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signatures viewable by authenticated" ON ebiomed.signatures
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Signatures insertable by authenticated" ON ebiomed.signatures
  FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND signer_id = auth.uid());

GRANT SELECT, INSERT ON ebiomed.signatures TO authenticated;
