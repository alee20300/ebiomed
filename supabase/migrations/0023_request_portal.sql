-- Phase 7: Request portal metadata, SLA tracking, and status notifications

ALTER TABLE ebiomed.complaints
  ADD COLUMN IF NOT EXISTS reference_number text,
  ADD COLUMN IF NOT EXISTS requester_email text,
  ADD COLUMN IF NOT EXISTS sla_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS converted_at timestamptz,
  ADD COLUMN IF NOT EXISTS converted_work_order_id uuid REFERENCES ebiomed.work_orders(id);

UPDATE ebiomed.complaints
SET reference_number = 'REQ-' || upper(substr(replace(id::text, '-', ''), 1, 8))
WHERE reference_number IS NULL;

UPDATE ebiomed.complaints
SET sla_due_at = created_at + interval '24 hours'
WHERE sla_due_at IS NULL;

ALTER TABLE ebiomed.complaints
  ALTER COLUMN reference_number SET NOT NULL,
  ALTER COLUMN sla_due_at SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_complaints_reference_number
  ON ebiomed.complaints(reference_number);

CREATE INDEX IF NOT EXISTS idx_complaints_department_status
  ON ebiomed.complaints(reported_by_department, status, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_complaints_sla_due
  ON ebiomed.complaints(sla_due_at)
  WHERE deleted_at IS NULL AND status = 'pending_review';

DROP POLICY IF EXISTS "Complaints insertable by public request portal" ON ebiomed.complaints;
CREATE POLICY "Complaints insertable by public request portal" ON ebiomed.complaints
  FOR INSERT TO anon WITH CHECK (true);

GRANT INSERT ON ebiomed.complaints TO anon;

CREATE TABLE IF NOT EXISTS ebiomed.request_notifications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  complaint_id uuid NOT NULL REFERENCES ebiomed.complaints(id) ON DELETE CASCADE,
  reference_number text NOT NULL,
  recipient_email text,
  event text NOT NULL,
  message text NOT NULL,
  created_by uuid REFERENCES ebiomed.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_request_notifications_complaint
  ON ebiomed.request_notifications(complaint_id, created_at DESC);

ALTER TABLE ebiomed.request_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Request notifications viewable by authenticated" ON ebiomed.request_notifications;
CREATE POLICY "Request notifications viewable by authenticated" ON ebiomed.request_notifications
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Request notifications insertable by admin or technician" ON ebiomed.request_notifications;
CREATE POLICY "Request notifications insertable by admin or technician" ON ebiomed.request_notifications
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND
    EXISTS (SELECT 1 FROM ebiomed.profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
  );

DROP POLICY IF EXISTS "Request notifications insertable for public submissions" ON ebiomed.request_notifications;
CREATE POLICY "Request notifications insertable for public submissions" ON ebiomed.request_notifications
  FOR INSERT TO anon WITH CHECK (event = 'submitted' AND created_by IS NULL);

GRANT SELECT, INSERT ON ebiomed.request_notifications TO authenticated;
GRANT INSERT ON ebiomed.request_notifications TO anon;

CREATE OR REPLACE FUNCTION ebiomed.get_public_request_status(p_reference text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ebiomed, public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', c.id,
    'equipment_id', c.equipment_id,
    'description', c.description,
    'photo_url', c.photo_url,
    'reported_by_name', c.reported_by_name,
    'reported_by_department', c.reported_by_department,
    'requester_email', NULL,
    'reference_number', c.reference_number,
    'status', c.status,
    'reviewer_id', NULL,
    'review_notes', c.review_notes,
    'sla_due_at', c.sla_due_at,
    'approved_at', c.approved_at,
    'rejected_at', c.rejected_at,
    'converted_at', c.converted_at,
    'converted_work_order_id', c.converted_work_order_id,
    'called_department', NULL,
    'answered_by', NULL,
    'call_status', NULL,
    'created_at', c.created_at,
    'updated_at', c.updated_at,
    'deleted_at', NULL,
    'equipment', CASE WHEN e.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', e.id,
      'tag_number', e.tag_number,
      'name', e.name,
      'department', e.department,
      'location', e.location
    ) END,
    'converted_work_order', CASE WHEN wo.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', wo.id,
      'status', wo.status,
      'created_at', wo.created_at
    ) END,
    'notifications', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', n.id,
        'complaint_id', n.complaint_id,
        'reference_number', n.reference_number,
        'recipient_email', NULL,
        'event', n.event,
        'message', n.message,
        'created_by', NULL,
        'created_at', n.created_at
      ) ORDER BY n.created_at DESC)
      FROM ebiomed.request_notifications n
      WHERE n.complaint_id = c.id
    ), '[]'::jsonb)
  )
  INTO result
  FROM ebiomed.complaints c
  LEFT JOIN ebiomed.equipment e ON e.id = c.equipment_id
  LEFT JOIN ebiomed.work_orders wo ON wo.id = c.converted_work_order_id
  WHERE c.reference_number = upper(trim(p_reference))
    AND c.deleted_at IS NULL
  LIMIT 1;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION ebiomed.get_public_request_status(text) TO anon, authenticated;
