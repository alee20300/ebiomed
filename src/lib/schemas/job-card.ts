import { z } from "zod"

export const jobCardCompleteSchema = z.object({
  summary: z.string().min(10, "Summary must be at least 10 characters"),
  unresolved_issues: z.string().optional(),
})

export const jobCardEntrySchema = z.object({
  description: z.string().min(1, "Description is required"),
  started_at: z.string(),
  ended_at: z.string(),
})

export const jobCardPartSchema = z.object({
  part_id: z.string().uuid("Valid part is required"),
  quantity_used: z.coerce.number().int().min(1, "Quantity must be at least 1"),
})
