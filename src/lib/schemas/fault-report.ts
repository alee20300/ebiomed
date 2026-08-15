import { z } from "zod"

export const faultReportSchema = z.object({
  equipment_id: z.string().uuid("Invalid equipment"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  reported_by_name: z.string().optional(),
  reported_by_department: z.string().optional(),
  requester_email: z.string().email("Enter a valid email address").optional().or(z.literal("")),
  reason: z.string().min(5, "Reason for change is required").max(500, "Reason too long").default("Fault reported via public portal"),
})

export const faultReportWithCallLogSchema = faultReportSchema.extend({
  called_department: z.preprocess(
    (value) => value === true || value === "true",
    z.literal(true, { message: "Biomedical department call must be recorded" })
  ),
  answered_by: z.string().min(1, "Select the biomedical engineer who was called"),
  call_status: z.enum(["informed", "not_picked"], { message: "Select the call status" }),
})

export type FaultReportFormData = z.infer<typeof faultReportSchema>
export type FaultReportWithCallLogFormData = z.infer<typeof faultReportWithCallLogSchema>
