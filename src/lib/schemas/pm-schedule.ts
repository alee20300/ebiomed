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
  checklist: z.union([z.array(checklistItemSchema), z.string()]).transform((val) => {
    if (Array.isArray(val)) return val
    return val
      .split("\n")
      .map((text, index) => ({
        id: `check-${index}`,
        text: text.trim(),
        completed: false,
      }))
      .filter((item) => item.text.length > 0)
  }).default([]),
  assigned_to: z.string().uuid().optional().or(z.literal("")),
  active: z.union([z.boolean(), z.string()]).transform((val) => {
    if (typeof val === "boolean") return val
    return val === "true"
  }).default(true),
  reason: z.string().min(5, "Reason for change is required").max(500, "Reason too long"),
})

export type PMScheduleFormData = z.infer<typeof pmScheduleSchema>
export type ChecklistItem = z.infer<typeof checklistItemSchema>
