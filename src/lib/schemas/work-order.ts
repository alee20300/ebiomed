import { z } from "zod"

export const woTypeEnum = z.enum(["corrective", "preventive"])
export const woPriorityEnum = z.enum(["low", "medium", "high", "critical"])
export const woStatusEnum = z.enum(["open", "in_progress", "on_hold", "completed", "cancelled"])

export const workOrderSchema = z.object({
  equipment_id: z.string().uuid("Valid equipment is required"),
  type: woTypeEnum.default("corrective"),
  priority: woPriorityEnum.default("medium"),
  description: z.string().min(1, "Description is required"),
  assigned_to: z.string().uuid().optional(),
})

export const workOrderUpdateSchema = z.object({
  status: woStatusEnum.optional(),
  assigned_to: z.string().uuid().optional(),
  priority: woPriorityEnum.optional(),
  resolution_notes: z.string().optional(),
})

export type WorkOrderFormData = z.infer<typeof workOrderSchema>
export type WorkOrderUpdateData = z.infer<typeof workOrderUpdateSchema>
