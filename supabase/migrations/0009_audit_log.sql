-- Phase 1: Immutable Audit Trail (FDA 21 CFR Part 11)
-- Creates audit_log table for append-only change tracking

CREATE TABLE ebiomed.audit_log (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('insert', 'update', 'delete')),
  field_name text,
  old_value text,
  new_value text,
  changed_by uuid NOT NULL REFERENCES ebiomed.profiles(id),
  changed_at timestamptz NOT NULL DEFAULT now(),
  reason text NOT NULL
);

CREATE INDEX idx_audit_log_table_record ON ebiomed.audit_log(table_name, record_id);
CREATE INDEX idx_audit_log_changed_by ON ebiomed.audit_log(changed_by);
CREATE INDEX idx_audit_log_changed_at ON ebiomed.audit_log(changed_at DESC);

ALTER TABLE ebiomed.audit_log ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view audit logs (read-only for compliance review)
CREATE POLICY "Audit log viewable by authenticated" ON ebiomed.audit_log
  FOR SELECT USING (auth.role() = 'authenticated');

-- No INSERT policy via RLS -- audit entries are created via security definer function below
-- This prevents direct inserts that could tamper with the audit trail

-- Security definer function for creating audit entries
-- Only accessible to authenticated users, bypasses RLS
CREATE OR REPLACE FUNCTION ebiomed.insert_audit_entry(
  p_table_name text,
  p_record_id uuid,
  p_action text,
  p_field_name text,
  p_old_value text,
  p_new_value text,
  p_reason text
) RETURNS void AS $$
BEGIN
  INSERT INTO ebiomed.audit_log (table_name, record_id, action, field_name, old_value, new_value, changed_by, reason)
  VALUES (p_table_name, p_record_id, p_action, p_field_name, p_old_value, p_new_value, auth.uid(), p_reason);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION ebiomed.insert_audit_entry(text, uuid, text, text, text, text, text) TO authenticated;

GRANT SELECT ON ebiomed.audit_log TO authenticated;
