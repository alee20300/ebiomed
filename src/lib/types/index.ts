export interface Equipment {
  id: string
  tag_number: string
  serial_number: string | null
  name: string
  model: string | null
  manufacturer: string | null
  department: string | null
  location: string | null
  status: "active" | "inactive" | "retired" | "under_repair" | "out_of_tolerance" | "certified"
  category: string | null
  install_date: string | null
  warranty_expiry: string | null
  photo_url: string | null
  notes: string | null
  calibration_interval_days: number | null
  calibration_parameters: CalibrationParameter[] | null
  last_calibrated: string | null
  next_calibration_due: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface WorkOrder {
  id: string
  equipment_id: string
  type: "corrective" | "preventive"
  priority: "low" | "medium" | "high" | "critical"
  status: "open" | "in_progress" | "on_hold" | "completed" | "cancelled"
  description: string
  assigned_to: string | null
  created_by: string
  created_at: string
  updated_at: string
  started_at: string | null
  completed_at: string | null
  resolution_notes: string | null
  downtime_minutes: number | null
  deleted_at: string | null
  equipment?: Equipment
  assigned_profile?: Profile | null
  created_profile?: Profile | null
}

export interface PMSchedule {
  id: string
  equipment_id: string
  frequency_days: number
  description: string | null
  checklist: ChecklistItem[]
  last_completed: string | null
  next_due: string | null
  assigned_to: string | null
  active: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
  equipment?: Equipment
}

export interface ChecklistItem {
  id: string
  text: string
  completed?: boolean
  status?: "ok" | "not_ok"
  type?: "checkbox" | "number" | "combobox"
  required?: boolean
  options?: string[]
}

export interface Part {
  id: string
  name: string
  part_number: string | null
  quantity_on_hand: number
  min_threshold: number
  unit_cost: number | null
  supplier: string | null
  location: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface PartsUsage {
  id: string
  work_order_id: string
  part_id: string
  quantity_used: number
  used_by: string
  used_at: string
  updated_at: string
  part?: Part
}

export interface Profile {
  id: string
  full_name: string
  role: "admin" | "technician" | "viewer"
  department: string | null
  phone: string | null
  created_at: string
  updated_at: string
}

export interface WoComment {
  id: string
  work_order_id: string
  author_id: string
  text: string
  created_at: string
  updated_at: string
  author?: { full_name: string; role: string } | null
}

export interface ChecklistTemplate {
  id: string
  equipment_id: string
  name: string
  items: ChecklistItem[]
  active: boolean
  frequency: string
  created_at: string
  updated_at: string
}

export interface ChecklistSubmission {
  id: string
  equipment_id: string
  template_id: string | null
  items: ChecklistItem[]
  notes: string | null
  submitted_by_name: string | null
  submitted_by_department: string | null
  work_order_id: string | null
  created_at: string
  updated_at: string
  equipment?: Equipment
  template?: ChecklistTemplate
}

export interface Department {
  id: string
  name: string
  created_at: string
  updated_at: string
}

export interface ViewerDepartment {
  viewer_id: string
  department_id: string
  updated_at: string
}

export interface AuditLogEntry {
  id: string
  table_name: string
  record_id: string
  action: "insert" | "update" | "delete"
  field_name: string | null
  old_value: string | null
  new_value: string | null
  changed_by: string
  changed_at: string
  reason: string
  profile?: Profile | null
}

export interface Signature {
  id: string
  signer_id: string
  record_type: string
  record_id: string
  meaning: "Verified" | "Calibrated" | "Approved" | "Reviewed"
  signed_at: string
  signature_hash: string | null
  signer?: Profile | null
}

export interface ReferenceStandard {
  id: string
  serial_number: string
  name: string
  manufacturer: string | null
  model: string | null
  certificate_number: string | null
  certificate_expiry: string
  calibration_interval_days: number
  location: string | null
  notes: string | null
  status: "active" | "expired" | "retired"
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface CalibrationReading {
  id: string
  equipment_id: string
  reference_standard_id: string | null
  parameter: string
  measured_value: number
  expected_value: number
  tolerance_min: number
  tolerance_max: number
  unit: string | null
  passed: boolean
  notes: string | null
  work_order_id: string | null
  recorded_at: string
  recorded_by: string
  reference_standard?: ReferenceStandard | null
  profile?: Profile | null
}

export interface EnvironmentalReading {
  id: string
  equipment_id: string | null
  calibration_reading_id: string | null
  temperature_celsius: number | null
  humidity_percent: number | null
  recorded_at: string
  recorded_by: string
}

export interface CalibrationParameter {
  parameter: string
  unit: string
  expected_value: number
  tolerance_min: number
  tolerance_max: number
}

export interface ToleranceResult {
  passed: boolean
  deviation: number
  deviationPercent: number
}
