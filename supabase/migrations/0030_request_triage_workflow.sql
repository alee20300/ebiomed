-- Phase 2: Biomedical request triage, risk SLAs, and duplicate tracking

ALTER TABLE ebiomed.complaints
  ADD COLUMN IF NOT EXISTS request_status text NOT NULL DEFAULT 'new'
    CHECK (request_status IN ('new', 'triaged', 'approved', 'rejected', 'converted')),
  ADD COLUMN IF NOT EXISTS clinical_impact text NOT NULL DEFAULT 'routine'
    CHECK (clinical_impact IN ('none', 'routine', 'care_delayed', 'patient_at_risk', 'patient_harm')),
  ADD COLUMN IF NOT EXISTS patient_safety_risk text NOT NULL DEFAULT 'none'
    CHECK (patient_safety_risk IN ('none', 'low', 'medium', 'high', 'critical')),
  ADD COLUMN IF NOT EXISTS urgency text NOT NULL DEFAULT 'normal'
    CHECK (urgency IN ('low', 'normal', 'urgent', 'emergency')),
  ADD COLUMN IF NOT EXISTS patient_care_critical boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS duplicate_of uuid REFERENCES ebiomed.complaints(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS triage_notes text,
  ADD COLUMN IF NOT EXISTS triaged_by uuid REFERENCES ebiomed.profiles(id),
  ADD COLUMN IF NOT EXISTS triaged_at timestamptz,
  ADD COLUMN IF NOT EXISTS sla_response_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS sla_resolution_due_at timestamptz;

UPDATE ebiomed.complaints
SET request_status = CASE
    WHEN converted_work_order_id IS NOT NULL THEN 'converted'
    WHEN status = 'approved' THEN 'approved'
    WHEN status = 'rejected' THEN 'rejected'
    ELSE request_status
  END,
  sla_response_due_at = COALESCE(sla_response_due_at, sla_due_at, created_at + interval '24 hours'),
  sla_resolution_due_at = COALESCE(sla_resolution_due_at, created_at + interval '72 hours')
WHERE request_status IS DISTINCT FROM CASE
    WHEN converted_work_order_id IS NOT NULL THEN 'converted'
    WHEN status = 'approved' THEN 'approved'
    WHEN status = 'rejected' THEN 'rejected'
    ELSE request_status
  END
  OR sla_response_due_at IS NULL
  OR sla_resolution_due_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_complaints_request_status
  ON ebiomed.complaints(request_status, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_complaints_triage_risk
  ON ebiomed.complaints(urgency, patient_safety_risk, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_complaints_duplicate_of
  ON ebiomed.complaints(duplicate_of)
  WHERE duplicate_of IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_complaints_sla_response_due
  ON ebiomed.complaints(sla_response_due_at)
  WHERE deleted_at IS NULL AND request_status IN ('new', 'triaged');

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
    'request_status', c.request_status,
    'clinical_impact', c.clinical_impact,
    'patient_safety_risk', c.patient_safety_risk,
    'urgency', c.urgency,
    'patient_care_critical', c.patient_care_critical,
    'duplicate_of', c.duplicate_of,
    'triage_notes', c.triage_notes,
    'triaged_by', NULL,
    'triaged_at', c.triaged_at,
    'reviewer_id', NULL,
    'review_notes', c.review_notes,
    'sla_due_at', c.sla_due_at,
    'sla_response_due_at', c.sla_response_due_at,
    'sla_resolution_due_at', c.sla_resolution_due_at,
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
