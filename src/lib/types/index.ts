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
  device_category: string | null
  asset_criticality: "low" | "medium" | "high" | "life_support"
  risk_class: "class_i" | "class_ii" | "class_iii" | "not_applicable"
  ownership_type: "owned" | "leased" | "rental" | "loaner" | "demo" | "vendor_owned"
  cost_center: string | null
  clinical_area: string | null
  manufacturer_device_id: string | null
  software_version: string | null
  firmware_version: string | null
  os_platform: string | null
  network_zone: string | null
  patch_status: "unknown" | "current" | "due" | "overdue" | "unsupported" | "risk_accepted"
  antivirus_status: "not_applicable" | "enabled" | "disabled" | "outdated" | "unsupported"
  backup_status: "not_applicable" | "current" | "stale" | "missing" | "failed"
  internet_exposed: boolean
  remote_access_enabled: boolean
  cybersecurity_owner: string | null
  risk_acceptance_status: "not_required" | "pending" | "accepted" | "expired" | "rejected"
  risk_acceptance_expires_at: string | null
  network_connected: boolean
  ip_address: string | null
  mac_address: string | null
  commissioned_at: string | null
  acceptance_test_date: string | null
  replacement_due_date: string | null
  retirement_reason: string | null
  install_date: string | null
  warranty_expiry: string | null
  acquisition_date: string | null
  purchase_cost: number | null
  expected_life_years: number | null
  residual_value: number | null
  current_value: number | null
  calculated_current_value: number | null
  depreciation_method: "straight_line" | "declining_balance" | "none"
  replacement_target_date: string | null
  lifecycle_stage: "planning" | "procurement" | "commissioning" | "in_service" | "limited_support" | "end_of_life" | "retired"
  commissioning_status: "not_required" | "pending_installation" | "installed" | "acceptance_testing" | "user_training" | "approved_for_service" | "rejected"
  commissioning_approved_by: string | null
  commissioning_approved_at: string | null
  decommissioning_status: "not_started" | "requested" | "in_progress" | "completed" | "rejected"
  decommissioned_by: string | null
  decommissioned_at: string | null
  patient_impact: number
  downtime_impact: number
  utilization: number
  regulatory_class: number
  maintenance_burden: number
  support_expiry: string | null
  lifecycle_risk_score: number | null
  lifecycle_risk_band: "Low" | "Moderate" | "High" | "Critical" | null
  service_cost_to_date: number
  downtime_minutes_to_date: number
  replacement_recommendation: "monitor" | "plan" | "replace" | null
  replacement_recommendation_label: string | null
  replacement_recommendation_reasons: string[]
  lifecycle_reviewed_at: string | null
  photo_url: string | null
  notes: string | null
  calibration_interval_days: number | null
  calibration_parameters: CalibrationParameter[] | null
  last_calibrated: string | null
  next_calibration_due: string | null
  parent_id: string | null
  parent?: Equipment | null
  children?: Equipment[] | null
  gmdn_code: string | null
  gmdn_term: string | null
  udi_di: string | null
  udi_pi: string | null
  run_hours: number
  cycle_count: number
  pm_trigger_type: "calendar" | "run_hours" | "cycles" | "calendar_or_usage" | "calendar_and_usage"
  pm_trigger_value: number | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface CybersecurityAssessment {
  id: string
  equipment_id: string
  assessment_status: "pass" | "monitor" | "risk_acceptance_required" | "fail"
  patch_status: Equipment["patch_status"]
  antivirus_status: Equipment["antivirus_status"]
  backup_status: Equipment["backup_status"]
  internet_exposed: boolean
  remote_access_enabled: boolean
  vulnerabilities: unknown[]
  assessment_notes: string
  risk_acceptance_reason: string | null
  risk_acceptance_expires_at: string | null
  assessed_by: string
  assessed_at: string
  created_at: string
  assessor?: Pick<Profile, "full_name" | "role"> | null
}

export interface CommissioningRecord {
  id: string
  equipment_id: string
  commissioning_status: Exclude<Equipment["commissioning_status"], "not_required">
  installation_verified: boolean
  acceptance_test_passed: boolean
  user_training_completed: boolean
  handover_completed: boolean
  evidence_notes: string
  approved_by: string | null
  approved_at: string | null
  created_by: string
  created_at: string
  creator?: Pick<Profile, "full_name" | "role"> | null
  approver?: Pick<Profile, "full_name" | "role"> | null
}

export interface DecommissioningRecord {
  id: string
  equipment_id: string
  disposal_method: string
  data_sanitization_status: "not_applicable" | "pending" | "completed" | "failed"
  accessories_recovered: boolean
  hazardous_material_checked: boolean
  finance_approval_reference: string | null
  final_location: string | null
  certificate_url: string | null
  evidence_notes: string
  completed_by: string
  completed_at: string
  created_at: string
  completer?: Pick<Profile, "full_name" | "role"> | null
}

export interface AssetDocument {
  id: string
  equipment_id: string
  document_type: "manual" | "certificate" | "purchase_doc" | "photo" | "warranty_doc" | "other"
  title: string
  file_url: string
  file_name: string | null
  mime_type: string | null
  expires_at: string | null
  retention_policy: string
  retain_until: string | null
  legal_hold: boolean
  legal_hold_reason: string | null
  uploaded_by: string | null
  created_at: string
  uploader?: Pick<Profile, "full_name" | "role"> | null
}

export interface WorkOrder {
  id: string
  equipment_id: string
  type: "corrective" | "preventive"
  priority: "low" | "medium" | "high" | "critical"
  status: "open" | "in_progress" | "on_hold" | "completed" | "cancelled"
  description: string
  failure_mode: string | null
  root_cause: string | null
  patient_safety_impact: "none" | "low" | "medium" | "high" | "critical"
  service_outcome: "repaired" | "no_fault_found" | "user_error" | "sent_to_vendor" | "parts_pending" | "replaced" | "retired" | null
  repeat_failure: boolean
  safety_escalated_at: string | null
  safety_escalated_by: string | null
  complaint_id: string | null
  pm_schedule_id: string | null
  pm_occurrence_id: string | null
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
  complaint?: Complaint | null
  assigned_profile?: Profile | null
  created_profile?: Profile | null
}

export interface WorkOrderPhoto {
  id: string
  work_order_id: string
  photo_url: string
  caption: string | null
  uploaded_by: string
  created_at: string
  uploader?: Pick<Profile, "full_name" | "role"> | null
}

export interface WorkOrderAttachment {
  id: string
  work_order_id: string
  file_url: string
  file_name: string | null
  mime_type: string
  media_type: "image" | "video"
  file_size_bytes: number | null
  caption: string | null
  uploaded_by: string
  created_at: string
  uploader?: Pick<Profile, "full_name" | "role"> | null
  photo_url?: string
}

export type ComplaintStatus = "pending_review" | "approved" | "rejected"
export type RequestStatus = "new" | "triaged" | "approved" | "rejected" | "converted"
export type ClinicalImpact = "none" | "routine" | "care_delayed" | "patient_at_risk" | "patient_harm"
export type PatientSafetyRisk = "none" | "low" | "medium" | "high" | "critical"
export type RequestUrgency = "low" | "normal" | "urgent" | "emergency"
export type JobCardStatus = "in_progress" | "completed"
export type ExpenseCategory = "food" | "ticket" | "accommodation"
export type CallStatus = "informed" | "not_picked" | "not_called" | "answered" | "unanswered"

export interface Complaint {
  id: string
  equipment_id: string
  description: string
  photo_url: string | null
  reported_by_name: string | null
  reported_by_department: string | null
  requester_email: string | null
  reference_number: string
  status: ComplaintStatus
  request_status: RequestStatus
  clinical_impact: ClinicalImpact
  patient_safety_risk: PatientSafetyRisk
  urgency: RequestUrgency
  patient_care_critical: boolean
  duplicate_of: string | null
  triage_notes: string | null
  triaged_by: string | null
  triaged_at: string | null
  reviewer_id: string | null
  review_notes: string | null
  sla_due_at: string
  sla_response_due_at: string | null
  sla_resolution_due_at: string | null
  approved_at: string | null
  rejected_at: string | null
  converted_at: string | null
  converted_work_order_id: string | null
  called_department: boolean | null
  answered_by: string | null
  call_status: CallStatus | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  equipment?: Equipment
  duplicate_request?: Complaint | null
  reviewer?: Profile | null
  visits?: VisitLog[]
  converted_work_order?: WorkOrder | null
  notifications?: RequestNotification[]
}

export interface RequestNotification {
  id: string
  complaint_id: string
  reference_number: string
  recipient_email: string | null
  event: "submitted" | "triaged" | "approved" | "rejected" | "converted"
  message: string
  delivery_channel: "email" | "sms" | "whatsapp" | "webhook" | "in_app"
  delivery_status: "pending" | "sent" | "failed" | "skipped"
  delivery_attempts: number
  delivered_at: string | null
  last_attempt_at: string | null
  last_error: string | null
  provider_message_id: string | null
  read_at: string | null
  created_by: string | null
  created_at: string
  creator?: Pick<Profile, "full_name" | "role"> | null
}

export interface VisitLog {
  id: string
  complaint_id: string
  visited_by: string
  visited_at: string
  created_at: string
  visited_profile?: Profile | null
}

export interface JobCard {
  id: string
  work_order_id: string
  technician_id: string
  status: JobCardStatus
  started_at: string
  completed_at: string | null
  summary: string | null
  unresolved_issues: string | null
  created_at: string
  updated_at: string
  technician?: Profile | null
  entries?: JobCardEntry[]
  parts?: JobCardPartUsage[]
  expenses?: JobCardExpense[]
}

export interface JobCardEntry {
  id: string
  job_card_id: string
  description: string
  started_at: string
  ended_at: string
  duration_minutes: number
}

export interface JobCardPartUsage {
  id: string
  job_card_id: string
  part_id: string
  quantity_used: number
  part?: Part | null
}

export interface JobCardExpense {
  id: string
  job_card_id: string
  category: ExpenseCategory
  amount: number
  description: string
  slip_url: string | null
}

export interface AppSetting {
  key: string
  value: unknown
  updated_by: string | null
  updated_at: string
}

export interface PMSchedule {
  id: string
  equipment_id: string
  frequency_days: number
  trigger_type: "calendar" | "run_hours" | "cycles" | "calendar_or_usage" | "calendar_and_usage"
  calendar_interval_days: number | null
  meter_interval: number | null
  cycle_interval: number | null
  risk_modifier: number
  grace_period_days: number
  escalation_policy: {
    assignee_after_days?: number
    admin_after_days?: number
    department_after_days?: number
  } | null
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
  occurrences?: PMOccurrence[]
}

export interface PMOccurrence {
  id: string
  pm_schedule_id: string
  equipment_id: string
  due_at: string
  trigger_type: "calendar" | "run_hours" | "cycles" | "calendar_or_usage" | "calendar_and_usage"
  due_meter: number | null
  due_cycle: number | null
  status: "due" | "generated" | "completed" | "missed" | "skipped"
  work_order_id: string | null
  generated_at: string | null
  completed_at: string | null
  missed_at: string | null
  skipped_at: string | null
  skipped_by: string | null
  skip_reason: string | null
  escalation_level: "none" | "assignee" | "admin" | "department"
  last_escalated_at: string | null
  created_at: string
  updated_at: string
  equipment?: Equipment
  schedule?: PMSchedule
  work_order?: WorkOrder | null
}

export interface PMEscalationNotification {
  id: string
  pm_occurrence_id: string
  pm_schedule_id: string
  equipment_id: string
  escalation_level: "assignee" | "admin" | "department"
  recipient_type: "assignee" | "admin" | "department"
  recipient_user_id: string | null
  recipient_department: string | null
  message: string
  sent_at: string
  created_at: string
  occurrence?: PMOccurrence
  equipment?: Equipment
}

export interface PMEngineRun {
  id: string
  started_at: string
  finished_at: string
  status: "success" | "partial_failure" | "failed"
  checked_schedules: number
  created_occurrences: number
  processed_occurrences: number
  generated_work_orders: number
  escalations: number
  missed_occurrences: number
  failures: number
  failure_details: Array<{ scope: string; id?: string; message: string }>
  triggered_by: string
  created_at: string
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
  max_threshold: number | null
  reorder_quantity: number | null
  valuation_method: "standard_cost" | "fifo" | "weighted_average"
  unit_cost: number | null
  supplier: string | null
  location: string | null
  preferred_vendor_id: string | null
  vendor_price: number | null
  lead_time_days: number | null
  stock_location: string | null
  bin_code: string | null
  lot_number: string | null
  expiry_date: string | null
  quarantine_status: "released" | "quarantined" | "expired" | "recalled"
  quarantine_reason: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  preferred_vendor?: Vendor | null
}

export interface StockLocation {
  id: string
  code: string
  name: string
  site: string | null
  building: string | null
  floor: string | null
  room: string | null
  active: boolean
  created_at: string
  updated_at: string
}

export interface PartStockBalance {
  id: string
  part_id: string
  stock_location_id: string
  bin_code: string | null
  quantity_on_hand: number
  min_threshold: number
  max_threshold: number | null
  reorder_quantity: number | null
  unit_cost: number | null
  created_at: string
  updated_at: string
  part?: Pick<Part, "name" | "part_number"> | null
  stock_location?: Pick<StockLocation, "name" | "code"> | null
}

export interface InventoryTransaction {
  id: string
  part_id: string
  stock_location_id: string | null
  bin_code: string | null
  transaction_type: "receipt" | "usage" | "adjustment" | "cycle_count" | "transfer_in" | "transfer_out"
  quantity_delta: number
  unit_cost: number | null
  work_order_id: string | null
  job_card_id: string | null
  job_card_part_id: string | null
  purchase_order_line_id: string | null
  reference: string | null
  reason: string
  recorded_by: string | null
  recorded_at: string
  part?: Pick<Part, "name" | "part_number"> | null
  stock_location?: Pick<StockLocation, "name" | "code"> | null
}

export interface CycleCount {
  id: string
  count_number: string
  part_id: string
  stock_location_id: string | null
  bin_code: string | null
  expected_quantity: number
  counted_quantity: number
  variance: number
  reason: string
  counted_at: string
  part?: Pick<Part, "name" | "part_number"> | null
  stock_location?: Pick<StockLocation, "name" | "code"> | null
}

export interface InventoryValuationRow {
  part_id: string
  name: string
  part_number: string | null
  stock_location: string
  bin_code: string | null
  quantity_on_hand: number
  unit_cost: number
  inventory_value: number
  valuation_method: Part["valuation_method"]
}

export interface LowStockRow {
  part_id: string
  name: string
  part_number: string | null
  stock_location: string
  bin_code: string | null
  quantity_on_hand: number
  min_threshold: number
  max_threshold: number | null
  reorder_quantity: number
  preferred_vendor_id: string | null
  vendor_price: number | null
  lead_time_days: number | null
}

export interface ReorderSuggestion extends LowStockRow {
  vendor_name: string | null
  estimated_cost: number
  latest_supplier_price: number | null
  latest_supplier_price_at: string | null
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
  department_id: string | null
  site_id: string | null
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
  site_id: string | null
  created_at: string
  updated_at: string
}

export interface Site {
  id: string
  name: string
  code: string | null
  created_at: string
  updated_at: string
}

export interface PermissionGrant {
  id: string
  profile_id: string
  action: string
  resource: string
  scope_type: "global" | "site" | "building" | "floor" | "room" | "department"
  scope_id: string | null
  granted: boolean
  reason: string
  created_by: string | null
  created_at: string
  updated_at: string
  profile?: Pick<Profile, "full_name" | "role"> | null
}

export interface PermissionAuditEntry {
  id: string
  permission_grant_id: string | null
  profile_id: string
  action: string
  resource: string
  scope_type: PermissionGrant["scope_type"]
  scope_id: string | null
  old_granted: boolean | null
  new_granted: boolean | null
  changed_by: string | null
  reason: string
  changed_at: string
  profile?: Pick<Profile, "full_name"> | null
  changed_by_profile?: Pick<Profile, "full_name"> | null
}

export interface ViewerDepartment {
  viewer_id: string
  department_id: string
  updated_at: string
}

export interface Vendor {
  id: string
  name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  address: string | null
  notes: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface VendorPartPricing {
  id: string
  vendor_id: string
  part_id: string
  unit_price: number
  lead_time_days: number
  stock_location: string | null
  is_preferred: boolean
  created_at: string
  updated_at: string
  vendor?: Vendor | null
  part?: Part | null
}

export interface PurchaseRequest {
  id: string
  request_number: string
  part_id: string
  vendor_id: string | null
  requested_quantity: number
  estimated_unit_cost: number | null
  needed_by: string | null
  status: "pending_approval" | "approved" | "rejected" | "converted" | "cancelled"
  source: string
  approval_level: "standard" | "department_head" | "finance"
  approval_threshold_exceeded: boolean
  reason: string
  requested_by: string
  approved_by: string | null
  approved_at: string | null
  rejected_by: string | null
  rejected_at: string | null
  rejection_reason: string | null
  second_approved_by: string | null
  second_approved_at: string | null
  purchase_order_id: string | null
  created_at: string
  updated_at: string
  part?: Part | null
  vendor?: Vendor | null
  requester?: Pick<Profile, "full_name" | "role"> | null
}

export interface PurchaseOrderLine {
  id: string
  purchase_order_id: string
  part_id: string
  quantity_ordered: number
  quantity_received: number
  unit_cost: number
  stock_location: string | null
  created_at: string
  updated_at: string
  part?: Part | null
}

export interface PurchaseOrder {
  id: string
  po_number: string
  vendor_id: string
  purchase_request_id: string | null
  status: "draft" | "issued" | "partially_received" | "received" | "cancelled"
  ordered_by: string
  ordered_at: string
  expected_delivery: string | null
  total_amount: number
  notes: string | null
  created_at: string
  updated_at: string
  vendor?: Vendor | null
  lines?: PurchaseOrderLine[]
}

export interface Contract {
  id: string
  vendor_id: string
  contract_number: string
  contract_type: "AMC" | "CMC"
  title: string
  start_date: string
  end_date: string
  alert_days_before_expiry: number
  annual_cost: number | null
  sla_response_hours: number | null
  status: "active" | "expiring" | "expired" | "cancelled"
  status_reviewed_at: string | null
  expiry_alert_sent_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
  vendor?: Vendor | null
  assets?: ContractAsset[]
}

export interface ContractAsset {
  id: string
  contract_id: string
  equipment_id: string
  coverage_notes: string | null
  created_at: string
  equipment?: Equipment | null
}

export interface VendorPerformanceSummary {
  vendor: Vendor
  event_count: number
  average_response_hours: number | null
  sla_hit_rate: number | null
  total_cost: number
  repeat_failures: number
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
  reason: string
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
  investigation_status: "not_required" | "required" | "in_progress" | "completed"
  investigation_notes: string | null
  corrective_action: string | null
  investigated_by: string | null
  investigated_at: string | null
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

export interface Certificate {
  id: string
  equipment_id: string
  certificate_number: string
  calibration_work_order_id: string | null
  audit_trail_hash: string
  pdf_url: string | null
  issued_by: string
  issued_at: string
  valid_until: string
  status: "valid" | "expired" | "revoked"
  equipment?: Equipment | null
  issuer?: Profile | null
  revocation?: CertificateRevocation | null
}

export interface CertificateRevocation {
  id: string
  certificate_id: string
  revoked_by: string
  revoked_at: string
  reason: string
  revoker?: Profile | null
}
