import { z } from "zod"

export const woTypeEnum = z.enum(["corrective", "preventive"])
export const woPriorityEnum = z.enum(["low", "medium", "high", "critical"])
export const woStatusEnum = z.enum(["open", "in_progress", "on_hold", "completed", "cancelled"])
export const patientSafetyImpactEnum = z.enum(["none", "low", "medium", "high", "critical"])
export const serviceOutcomeEnum = z.enum(["repaired", "no_fault_found", "user_error", "sent_to_vendor", "parts_pending", "replaced", "retired"])

export const workOrderSchema = z.object({
  equipment_id: z.string().uuid("Valid equipment is required"),
  type: woTypeEnum.default("corrective"),
  priority: woPriorityEnum.default("medium"),
  description: z.string().min(1, "Description is required"),
  failure_mode: z.string().max(120, "Failure mode too long").optional(),
  patient_safety_impact: patientSafetyImpactEnum.default("none"),
  assigned_to: z.string().uuid().optional(),
  reason: z.string().min(5, "Reason for change is required").max(500, "Reason too long"),
})

export const workOrderUpdateSchema = z.object({
  status: woStatusEnum.optional(),
  assigned_to: z.string().uuid().optional(),
  priority: woPriorityEnum.optional(),
  failure_mode: z.string().max(120, "Failure mode too long").optional(),
  root_cause: z.string().max(500, "Root cause too long").optional(),
  patient_safety_impact: patientSafetyImpactEnum.optional(),
  service_outcome: serviceOutcomeEnum.optional(),
  repeat_failure: z.preprocess((value) => value === "on" || value === "true" || value === true, z.boolean()).optional(),
  resolution_notes: z.string().optional(),
  reason: z.string().min(5, "Reason for change is required").max(500, "Reason too long"),
}).refine(
  (data) => data.status !== "completed" || !!data.service_outcome,
  {
    message: "Service outcome is required before work order closeout",
    path: ["service_outcome"],
  }
).refine(
  (data) => data.status !== "completed" || !!data.root_cause?.trim(),
  {
    message: "Root cause is required before work order closeout",
    path: ["root_cause"],
  }
)

export type WorkOrderFormData = z.infer<typeof workOrderSchema>
export type WorkOrderUpdateData = z.infer<typeof workOrderUpdateSchema>
