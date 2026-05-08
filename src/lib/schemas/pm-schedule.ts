import { z } from "zod"

export const checklistItemSchema = z.object({
  id: z.string(),
  text: z.string(),
  completed: z.boolean().default(false),
})

export const pmScheduleSchema = z.object({
  equipment_id: z.string().uuid("Valid equipment is required"),
  frequency_days: z.coerce.number().int().min(1, "Must be at least 1 day"),
  description: z.string().optional(),
  checklist: z.array(checklistItemSchema).default([]),
  assigned_to: z.string().uuid().optional(),
  active: z.boolean().default(true),
})

export type PMScheduleFormData = z.infer<typeof pmScheduleSchema>
export type ChecklistItem = z.infer<typeof checklistItemSchema>
