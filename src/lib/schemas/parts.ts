import { z } from "zod"

export const partSchema = z.object({
  name: z.string().min(1, "Part name is required"),
  part_number: z.string().optional(),
  quantity_on_hand: z.coerce.number().int().min(0),
  min_threshold: z.coerce.number().int().min(0).default(5),
  unit_cost: z.coerce.number().min(0).optional(),
  supplier: z.string().optional(),
  location: z.string().optional(),
  reason: z.string().min(5, "Reason for change is required").max(500, "Reason too long"),
})

export const partRestockSchema = z.object({
  id: z.string().uuid(),
  quantity: z.coerce.number().int().min(1, "Must add at least 1"),
  reason: z.string().min(5, "Reason for change is required").max(500, "Reason too long"),
})

export const partsUsageSchema = z.object({
  work_order_id: z.string().uuid(),
  part_id: z.string().uuid("Select a part"),
  quantity_used: z.coerce.number().int().min(1, "Must use at least 1"),
  reason: z.string().min(5, "Reason for change is required").max(500, "Reason too long"),
})

export type PartFormData = z.infer<typeof partSchema>
export type PartsUsageFormData = z.infer<typeof partsUsageSchema>
