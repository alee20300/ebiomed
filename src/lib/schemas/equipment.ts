import { z } from "zod"

export const equipmentStatusEnum = z.enum(["active", "inactive", "retired", "under_repair", "out_of_tolerance", "certified"])
export const pmTriggerTypeEnum = z.enum(["calendar", "run_hours", "cycles", "calendar_or_usage", "calendar_and_usage"])
export const depreciationMethodEnum = z.enum(["straight_line", "declining_balance", "none"])
export const lifecycleStageEnum = z.enum(["planning", "procurement", "commissioning", "in_service", "limited_support", "end_of_life", "retired"])
export const assetDocumentTypeEnum = z.enum(["manual", "certificate", "purchase_doc", "photo", "warranty_doc", "other"])
export const assetCriticalityEnum = z.enum(["low", "medium", "high", "life_support"])
export const equipmentRiskClassEnum = z.enum(["class_i", "class_ii", "class_iii", "not_applicable"])
export const ownershipTypeEnum = z.enum(["owned", "leased", "rental", "loaner", "demo", "vendor_owned"])
export const patchStatusEnum = z.enum(["unknown", "current", "due", "overdue", "unsupported", "risk_accepted"])
export const antivirusStatusEnum = z.enum(["not_applicable", "enabled", "disabled", "outdated", "unsupported"])
export const backupStatusEnum = z.enum(["not_applicable", "current", "stale", "missing", "failed"])
export const riskAcceptanceStatusEnum = z.enum(["not_required", "pending", "accepted", "expired", "rejected"])
export const commissioningStatusEnum = z.enum(["not_required", "pending_installation", "installed", "acceptance_testing", "user_training", "approved_for_service", "rejected"])
export const decommissioningStatusEnum = z.enum(["not_started", "requested", "in_progress", "completed", "rejected"])

const optionalNonNegativeNumber = z.preprocess(
  (value) => value === "" || value === null || value === undefined ? undefined : Number(value),
  z.number().nonnegative("Must be zero or greater").optional()
)

const optionalNonNegativeInteger = z.preprocess(
  (value) => value === "" || value === null || value === undefined ? undefined : Number(value),
  z.number().int("Must be a whole number").nonnegative("Must be zero or greater").optional()
)

const optionalPositiveNumber = z.preprocess(
  (value) => value === "" || value === null || value === undefined ? undefined : Number(value),
  z.number().positive("Must be greater than zero").optional()
)

const optionalDate = z.string().optional()

const ipv4Pattern = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/

const optionalIpAddress = z.preprocess(
  (value) => value === "" || value === null || value === undefined ? undefined : value,
  z.string().regex(ipv4Pattern, "Enter a valid IPv4 address").optional()
)

const optionalMacAddress = z.preprocess(
  (value) => value === "" || value === null || value === undefined ? undefined : String(value).toUpperCase(),
  z.string().regex(/^([0-9A-F]{2}[:-]){5}([0-9A-F]{2})$/, "Enter a valid MAC address").optional()
)

const checkboxBoolean = z.preprocess(
  (value) => value === "on" || value === "true" || value === true,
  z.boolean()
)

const impactScore = z.preprocess(
  (value) => value === "" || value === null || value === undefined ? 3 : Number(value),
  z.number().int("Must be a whole number").min(1).max(5)
)

export const equipmentSchema = z.object({
  tag_number: z.string().min(1, "Tag number is required"),
  serial_number: z.string().optional(),
  name: z.string().min(1, "Equipment name is required"),
  model: z.string().optional(),
  manufacturer: z.string().optional(),
  department: z.string().optional(),
  location: z.string().optional(),
  status: equipmentStatusEnum.default("active"),
  category: z.string().optional(),
  device_category: z.string().optional(),
  asset_criticality: assetCriticalityEnum.default("medium"),
  risk_class: equipmentRiskClassEnum.default("class_ii"),
  ownership_type: ownershipTypeEnum.default("owned"),
  cost_center: z.string().optional(),
  clinical_area: z.string().optional(),
  manufacturer_device_id: z.string().optional(),
  software_version: z.string().optional(),
  firmware_version: z.string().optional(),
  os_platform: z.string().optional(),
  network_zone: z.string().optional(),
  patch_status: patchStatusEnum.default("unknown"),
  antivirus_status: antivirusStatusEnum.default("not_applicable"),
  backup_status: backupStatusEnum.default("not_applicable"),
  internet_exposed: checkboxBoolean.default(false),
  remote_access_enabled: checkboxBoolean.default(false),
  risk_acceptance_status: riskAcceptanceStatusEnum.default("not_required"),
  risk_acceptance_expires_at: optionalDate,
  network_connected: checkboxBoolean.default(false),
  ip_address: optionalIpAddress,
  mac_address: optionalMacAddress,
  commissioned_at: optionalDate,
  acceptance_test_date: optionalDate,
  replacement_due_date: optionalDate,
  retirement_reason: z.string().max(500, "Retirement reason too long").optional(),
  install_date: z.string().optional(),
  warranty_expiry: z.string().optional(),
  acquisition_date: optionalDate,
  purchase_cost: optionalNonNegativeNumber,
  expected_life_years: optionalPositiveNumber,
  residual_value: optionalNonNegativeNumber,
  current_value: optionalNonNegativeNumber,
  depreciation_method: depreciationMethodEnum.default("straight_line"),
  replacement_target_date: optionalDate,
  lifecycle_stage: lifecycleStageEnum.default("commissioning"),
  commissioning_status: commissioningStatusEnum.default("pending_installation"),
  decommissioning_status: decommissioningStatusEnum.default("not_started"),
  patient_impact: impactScore,
  downtime_impact: impactScore,
  utilization: impactScore,
  regulatory_class: impactScore,
  maintenance_burden: impactScore,
  support_expiry: optionalDate,
  notes: z.string().optional(),
  parent_id: z.string().uuid().optional().or(z.literal("")),
  gmdn_code: z.string().optional(),
  gmdn_term: z.string().optional(),
  udi_di: z.string().optional(),
  udi_pi: z.string().optional(),
  run_hours: optionalNonNegativeNumber,
  cycle_count: optionalNonNegativeInteger,
  pm_trigger_type: pmTriggerTypeEnum.default("calendar"),
  pm_trigger_value: optionalPositiveNumber,
  reason: z.string().min(5, "Reason for change is required").max(500, "Reason too long"),
}).refine(
  (data) => !data.install_date || !data.warranty_expiry || data.warranty_expiry >= data.install_date,
  {
    message: "Warranty expiry cannot be before install date",
    path: ["warranty_expiry"],
  }
).refine(
  (data) => data.pm_trigger_type === "calendar" || data.pm_trigger_value !== undefined,
  {
    message: "A PM trigger threshold is required for usage-based PM",
    path: ["pm_trigger_value"],
  }
).refine(
  (data) => !data.acquisition_date || !data.replacement_target_date || data.replacement_target_date >= data.acquisition_date,
  {
    message: "Replacement target cannot be before acquisition date",
    path: ["replacement_target_date"],
  }
).refine(
  (data) => !data.acquisition_date || !data.replacement_due_date || data.replacement_due_date >= data.acquisition_date,
  {
    message: "Replacement due date cannot be before acquisition date",
    path: ["replacement_due_date"],
  }
).refine(
  (data) => !data.commissioned_at || !data.acceptance_test_date || data.acceptance_test_date <= data.commissioned_at,
  {
    message: "Acceptance test date cannot be after commissioning date",
    path: ["acceptance_test_date"],
  }
).refine(
  (data) => !data.network_connected || !!data.ip_address || !!data.mac_address,
  {
    message: "Network-connected assets require an IP address or MAC address",
    path: ["ip_address"],
  }
).refine(
  (data) => !data.network_connected || !!data.os_platform?.trim(),
  {
    message: "Network-connected assets require OS/platform",
    path: ["os_platform"],
  }
).refine(
  (data) => data.risk_acceptance_status !== "accepted" || !!data.risk_acceptance_expires_at,
  {
    message: "Accepted cyber risk requires an expiry date",
    path: ["risk_acceptance_expires_at"],
  }
).refine(
  (data) => data.lifecycle_stage !== "retired" || !!data.retirement_reason?.trim(),
  {
    message: "Retirement reason is required when lifecycle stage is retired",
    path: ["retirement_reason"],
  }
)

export type EquipmentFormData = z.infer<typeof equipmentSchema>

export const assetDocumentSchema = z.object({
  document_type: assetDocumentTypeEnum,
  title: z.string().min(1, "Document title is required").max(120, "Title too long"),
  expires_at: optionalDate,
  retention_policy: z.string().min(1).max(80).default("standard_7_years"),
  retain_until: optionalDate,
  legal_hold: z.preprocess((value) => value === "on" || value === "true" || value === true, z.boolean()).default(false),
  legal_hold_reason: z.string().max(500).optional(),
}).refine(
  (data) => !data.legal_hold || !!data.legal_hold_reason?.trim(),
  {
    message: "Legal hold reason is required when legal hold is enabled",
    path: ["legal_hold_reason"],
  }
)

export type AssetDocumentFormData = z.infer<typeof assetDocumentSchema>
