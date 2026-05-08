import { z } from "zod"

export const faultReportSchema = z.object({
  equipment_id: z.string().uuid("Invalid equipment"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  reported_by_name: z.string().optional(),
  reported_by_department: z.string().optional(),
})

export type FaultReportFormData = z.infer<typeof faultReportSchema>
