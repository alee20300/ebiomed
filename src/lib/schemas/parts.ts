import { z } from "zod"

export const partSchema = z.object({
  name: z.string().min(1, "Part name is required"),
  part_number: z.string().optional(),
  quantity_on_hand: z.coerce.number().int().min(0),
  min_threshold: z.coerce.number().int().min(0).default(5),
  max_threshold: z.coerce.number().int().min(0).optional(),
  reorder_quantity: z.coerce.number().int().min(1).optional(),
  valuation_method: z.enum(["standard_cost", "fifo", "weighted_average"]).default("standard_cost"),
  unit_cost: z.coerce.number().min(0).optional(),
  supplier: z.string().optional(),
  location: z.string().optional(),
  preferred_vendor_id: z.string().uuid().or(z.literal("")).optional(),
  vendor_price: z.coerce.number().min(0).optional(),
  lead_time_days: z.coerce.number().int().min(0).optional(),
  stock_location: z.string().optional(),
  bin_code: z.string().optional(),
  lot_number: z.string().optional(),
  expiry_date: z.string().optional(),
  quarantine_status: z.enum(["released", "quarantined", "expired", "recalled"]).default("released"),
  quarantine_reason: z.string().optional(),
  reason: z.string().min(5, "Reason for change is required").max(500, "Reason too long").optional(),
}).refine(
  (data) => data.quarantine_status === "released" || !!data.quarantine_reason?.trim(),
  {
    message: "Quarantine reason is required when stock is not released",
    path: ["quarantine_reason"],
  }
)

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
