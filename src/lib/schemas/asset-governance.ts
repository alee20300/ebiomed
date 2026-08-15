import { z } from "zod"

export const patchStatusEnum = z.enum(["unknown", "current", "due", "overdue", "unsupported", "risk_accepted"])
export const antivirusStatusEnum = z.enum(["not_applicable", "enabled", "disabled", "outdated", "unsupported"])
export const backupStatusEnum = z.enum(["not_applicable", "current", "stale", "missing", "failed"])
export const cybersecurityAssessmentStatusEnum = z.enum(["pass", "monitor", "risk_acceptance_required", "fail"])
export const commissioningStatusEnum = z.enum(["pending_installation", "installed", "acceptance_testing", "user_training", "approved_for_service", "rejected"])
export const dataSanitizationStatusEnum = z.enum(["not_applicable", "pending", "completed", "failed"])

const checkboxBoolean = z.preprocess((value) => value === "on" || value === "true" || value === true, z.boolean())
const optionalDate = z.string().optional()

export const cybersecurityAssessmentSchema = z.object({
  equipment_id: z.string().uuid(),
  assessment_status: cybersecurityAssessmentStatusEnum,
  patch_status: patchStatusEnum,
  antivirus_status: antivirusStatusEnum,
  backup_status: backupStatusEnum,
  internet_exposed: checkboxBoolean.default(false),
  remote_access_enabled: checkboxBoolean.default(false),
  vulnerabilities: z.string().optional(),
  assessment_notes: z.string().min(5, "Assessment notes are required"),
  risk_acceptance_reason: z.string().optional(),
  risk_acceptance_expires_at: optionalDate,
  reauth_password: z.string().optional(),
}).refine(
  (data) => data.assessment_status !== "risk_acceptance_required" || !!data.risk_acceptance_reason?.trim(),
  {
    message: "Risk acceptance reason is required",
    path: ["risk_acceptance_reason"],
  }
).refine(
  (data) => data.assessment_status !== "risk_acceptance_required" || !!data.risk_acceptance_expires_at,
  {
    message: "Risk acceptance expiry is required",
    path: ["risk_acceptance_expires_at"],
  }
)

export const commissioningRecordSchema = z.object({
  equipment_id: z.string().uuid(),
  commissioning_status: commissioningStatusEnum,
  installation_verified: checkboxBoolean.default(false),
  acceptance_test_passed: checkboxBoolean.default(false),
  user_training_completed: checkboxBoolean.default(false),
  handover_completed: checkboxBoolean.default(false),
  evidence_notes: z.string().min(5, "Commissioning evidence notes are required"),
  reauth_password: z.string().optional(),
}).refine(
  (data) => data.commissioning_status !== "approved_for_service" || !!data.reauth_password?.trim(),
  {
    message: "Re-authentication is required before service approval",
    path: ["reauth_password"],
  }
).refine(
  (data) => data.commissioning_status !== "approved_for_service" || (
    data.installation_verified &&
    data.acceptance_test_passed &&
    data.user_training_completed &&
    data.handover_completed
  ),
  {
    message: "Installation, acceptance test, user training, and handover must be complete before service approval",
    path: ["commissioning_status"],
  }
)

export const decommissioningRecordSchema = z.object({
  equipment_id: z.string().uuid(),
  disposal_method: z.string().min(2, "Disposal method is required"),
  data_sanitization_status: dataSanitizationStatusEnum,
  accessories_recovered: checkboxBoolean.default(false),
  hazardous_material_checked: checkboxBoolean.default(false),
  finance_approval_reference: z.string().optional(),
  final_location: z.string().optional(),
  certificate_url: z.string().url("Enter a valid certificate URL").optional().or(z.literal("")),
  evidence_notes: z.string().min(5, "Decommissioning evidence notes are required"),
  reauth_password: z.string().min(1, "Re-authentication is required"),
}).refine(
  (data) => data.hazardous_material_checked,
  {
    message: "Hazardous material check is required before decommissioning",
    path: ["hazardous_material_checked"],
  }
)

export type CybersecurityAssessmentFormData = z.infer<typeof cybersecurityAssessmentSchema>
export type CommissioningRecordFormData = z.infer<typeof commissioningRecordSchema>
export type DecommissioningRecordFormData = z.infer<typeof decommissioningRecordSchema>
