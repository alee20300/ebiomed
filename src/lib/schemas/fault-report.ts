import { z } from "zod"

export const faultReportSchema = z.object({
  equipment_id: z.string().uuid("Invalid equipment"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  reported_by_name: z.string().optional(),
  reported_by_department: z.string().optional(),
  reason: z.string().min(5, "Reason for change is required").max(500, "Reason too long").default("Fault reported via public portal"),
})

export const faultReportWithCallLogSchema = faultReportSchema.extend({
  called_department: z.union([z.boolean(), z.string()], { message: "Please indicate whether you called the department" }).transform((val) => {
    if (typeof val === "boolean") return val
    return val === "true"
  }),
  answered_by: z.string().optional(),
  call_status: z.enum(["answered", "unanswered"]),
})

export type FaultReportFormData = z.infer<typeof faultReportSchema>
export type FaultReportWithCallLogFormData = z.infer<typeof faultReportWithCallLogSchema>
