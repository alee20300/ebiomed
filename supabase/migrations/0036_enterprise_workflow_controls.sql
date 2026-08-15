-- Enterprise workflow controls for work orders, calibration, inventory, and purchasing.

ALTER TABLE ebiomed.work_orders
  ADD COLUMN IF NOT EXISTS failure_mode text,
  ADD COLUMN IF NOT EXISTS root_cause text,
  ADD COLUMN IF NOT EXISTS patient_safety_impact text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS service_outcome text,
  ADD COLUMN IF NOT EXISTS repeat_failure boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS safety_escalated_at timestamptz,
  ADD COLUMN IF NOT EXISTS safety_escalated_by uuid REFERENCES ebiomed.profiles(id);

ALTER TABLE ebiomed.work_orders
  DROP CONSTRAINT IF EXISTS work_orders_patient_safety_impact_check,
  DROP CONSTRAINT IF EXISTS work_orders_service_outcome_check,
  ADD CONSTRAINT work_orders_patient_safety_impact_check
    CHECK (patient_safety_impact IN ('none', 'low', 'medium', 'high', 'critical')),
  ADD CONSTRAINT work_orders_service_outcome_check
    CHECK (service_outcome IS NULL OR service_outcome IN ('repaired', 'no_fault_found', 'user_error', 'sent_to_vendor', 'parts_pending', 'replaced', 'retired'));

ALTER TABLE ebiomed.calibration_readings
  ADD COLUMN IF NOT EXISTS investigation_status text NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS investigation_notes text,
  ADD COLUMN IF NOT EXISTS corrective_action text,
  ADD COLUMN IF NOT EXISTS investigated_by uuid REFERENCES ebiomed.profiles(id),
  ADD COLUMN IF NOT EXISTS investigated_at timestamptz;

ALTER TABLE ebiomed.calibration_readings
  DROP CONSTRAINT IF EXISTS calibration_readings_investigation_status_check,
  ADD CONSTRAINT calibration_readings_investigation_status_check
    CHECK (investigation_status IN ('not_required', 'required', 'in_progress', 'completed'));

UPDATE ebiomed.calibration_readings
SET investigation_status = 'required'
WHERE passed = false AND investigation_status = 'not_required';

ALTER TABLE ebiomed.parts
  ADD COLUMN IF NOT EXISTS lot_number text,
  ADD COLUMN IF NOT EXISTS expiry_date date,
  ADD COLUMN IF NOT EXISTS quarantine_status text NOT NULL DEFAULT 'released',
  ADD COLUMN IF NOT EXISTS quarantine_reason text;

ALTER TABLE ebiomed.parts
  DROP CONSTRAINT IF EXISTS parts_quarantine_status_check,
  ADD CONSTRAINT parts_quarantine_status_check
    CHECK (quarantine_status IN ('released', 'quarantined', 'expired', 'recalled'));

ALTER TABLE ebiomed.purchase_requests
  ADD COLUMN IF NOT EXISTS approval_level text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS approval_threshold_exceeded boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS second_approved_by uuid REFERENCES ebiomed.profiles(id),
  ADD COLUMN IF NOT EXISTS second_approved_at timestamptz;

ALTER TABLE ebiomed.purchase_requests
  DROP CONSTRAINT IF EXISTS purchase_requests_approval_level_check,
  ADD CONSTRAINT purchase_requests_approval_level_check
    CHECK (approval_level IN ('standard', 'department_head', 'finance'));

CREATE INDEX IF NOT EXISTS idx_work_orders_failure_mode ON ebiomed.work_orders(failure_mode);
CREATE INDEX IF NOT EXISTS idx_work_orders_safety ON ebiomed.work_orders(patient_safety_impact, safety_escalated_at);
CREATE INDEX IF NOT EXISTS idx_calibration_investigation ON ebiomed.calibration_readings(investigation_status);
CREATE INDEX IF NOT EXISTS idx_parts_expiry_quarantine ON ebiomed.parts(expiry_date, quarantine_status);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_approval_level ON ebiomed.purchase_requests(approval_level, approval_threshold_exceeded);
