import { z } from "zod"

const optionalUuid = z.string().uuid().or(z.literal("")).optional()

export const vendorSchema = z.object({
  name: z.string().min(1, "Vendor name is required"),
  contact_name: z.string().optional(),
  email: z.string().email("Enter a valid email").or(z.literal("")).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
})

export const purchaseRequestSchema = z.object({
  part_id: z.string().uuid("Select a part"),
  vendor_id: optionalUuid,
  requested_quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  estimated_unit_cost: z.coerce.number().min(0).optional(),
  approval_level: z.enum(["standard", "department_head", "finance"]).optional(),
  needed_by: z.string().optional(),
  source: z.string().default("manual"),
  reason: z.string().min(5, "Reason is required").max(500, "Reason too long"),
})

export const purchaseRequestDecisionSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().optional(),
})

export const createPurchaseOrderSchema = z.object({
  purchase_request_id: z.string().uuid(),
  expected_delivery: z.string().optional(),
  notes: z.string().optional(),
})

export const receivePurchaseOrderLineSchema = z.object({
  purchase_order_id: z.string().uuid(),
  purchase_order_line_id: z.string().uuid(),
  quantity_received: z.coerce.number().int().min(1, "Receive at least 1"),
})

export const contractSchema = z.object({
  vendor_id: z.string().uuid("Select a vendor"),
  contract_number: z.string().min(1, "Contract number is required"),
  contract_type: z.enum(["AMC", "CMC"]),
  title: z.string().min(1, "Contract title is required"),
  start_date: z.string().min(1, "Start date is required"),
  end_date: z.string().min(1, "End date is required"),
  alert_days_before_expiry: z.coerce.number().int().min(0).default(30),
  annual_cost: z.coerce.number().min(0).optional(),
  sla_response_hours: z.coerce.number().int().min(0).optional(),
  notes: z.string().optional(),
})

export const contractAssetSchema = z.object({
  contract_id: z.string().uuid(),
  equipment_id: z.string().uuid("Select covered equipment"),
  coverage_notes: z.string().optional(),
})

export const vendorPerformanceEventSchema = z.object({
  vendor_id: z.string().uuid("Select a vendor"),
  work_order_id: optionalUuid,
  contract_id: optionalUuid,
  event_type: z.enum(["response", "sla", "cost", "repeat_failure"]),
  response_time_hours: z.coerce.number().min(0).optional(),
  sla_met: z.enum(["true", "false", ""]).optional(),
  cost_amount: z.coerce.number().min(0).optional(),
  repeat_failure: z.enum(["true", "false"]).default("false"),
  notes: z.string().optional(),
})

export type VendorFormData = z.infer<typeof vendorSchema>
export type PurchaseRequestFormData = z.infer<typeof purchaseRequestSchema>
export type ContractFormData = z.infer<typeof contractSchema>
