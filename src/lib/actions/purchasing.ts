"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/lib/actions/profiles"
import { logAudit } from "@/lib/actions/audit"
import { requirePermission } from "@/lib/actions/permissions"
import {
  contractAssetSchema,
  contractSchema,
  createPurchaseOrderSchema,
  purchaseRequestDecisionSchema,
  purchaseRequestSchema,
  receivePurchaseOrderLineSchema,
  vendorPerformanceEventSchema,
  vendorSchema,
} from "@/lib/schemas/purchasing"
import type {
  Contract,
  Equipment,
  Part,
  PurchaseOrder,
  PurchaseRequest,
  ReorderSuggestion,
  Vendor,
  VendorPerformanceSummary,
} from "@/lib/types"
import {
  getPurchaseOrderStatusAfterReceipt,
  getContractLifecycleStatus,
  getReorderQuantity,
  selectPurchaseRequestPricing,
  validatePurchaseOrderReceipt,
} from "@/lib/utils/purchasing"

function cleanRecord<T extends Record<string, unknown>>(record: T) {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, value === "" ? undefined : value])
  )
}

function purchasingRedirect(error: string): never {
  redirect(`/purchasing?error=${encodeURIComponent(error)}`)
}

function purchaseApprovalPolicy(totalAmount: number, requestedLevel?: "standard" | "department_head" | "finance") {
  const requiredLevel = totalAmount >= 10000 ? "finance" : totalAmount >= 2500 ? "department_head" : "standard"
  const levels = { standard: 1, department_head: 2, finance: 3 }
  return {
    approvalLevel: requestedLevel && levels[requestedLevel] > levels[requiredLevel] ? requestedLevel : requiredLevel,
    thresholdExceeded: requiredLevel !== "standard",
  }
}

async function requireUser() {
  const user = await getCurrentUser()
  if (!user) redirect("/login")
  return user
}

export async function createVendor(formData: FormData) {
  await requirePermission({ action: "write", resource: "purchasing" }, "/purchasing")
  const supabase = await createClient()
  const raw = cleanRecord(Object.fromEntries(formData))
  const parsed = vendorSchema.safeParse(raw)

  if (!parsed.success) {
    purchasingRedirect(parsed.error.issues.map((e) => e.message).join(", "))
  }

  const { data, error } = await supabase
    .from("vendors")
    .insert(parsed.data)
    .select()
    .single()

  if (error) purchasingRedirect(error.message)

  await logAudit("vendors", data.id, "insert", [{ newValue: JSON.stringify(parsed.data) }], "Vendor created")
  revalidatePath("/purchasing")
  revalidatePath("/parts")
  redirect("/purchasing")
}

export async function createPurchaseRequest(formData: FormData) {
  const supabase = await createClient()
  const user = await requireUser()
  await requirePermission({ action: "request", resource: "purchasing" }, "/purchasing")
  const raw = cleanRecord(Object.fromEntries(formData))
  const parsed = purchaseRequestSchema.safeParse(raw)

  if (!parsed.success) {
    purchasingRedirect(parsed.error.issues.map((e) => e.message).join(", "))
  }

  const totalAmount = Number(parsed.data.requested_quantity) * Number(parsed.data.estimated_unit_cost || 0)
  const approvalPolicy = purchaseApprovalPolicy(totalAmount, parsed.data.approval_level)
  const payload = {
    ...parsed.data,
    vendor_id: parsed.data.vendor_id || null,
    needed_by: parsed.data.needed_by || null,
    approval_level: approvalPolicy.approvalLevel,
    approval_threshold_exceeded: approvalPolicy.thresholdExceeded,
    requested_by: user.id,
  }

  const { data, error } = await supabase
    .from("purchase_requests")
    .insert(payload)
    .select()
    .single()

  if (error) purchasingRedirect(error.message)

  await logAudit("purchase_requests", data.id, "insert", [
    { newValue: JSON.stringify({ part_id: payload.part_id, requested_quantity: payload.requested_quantity }) }
  ], payload.reason)

  revalidatePath("/purchasing")
  revalidatePath("/parts")
  revalidatePath("/dashboard")
  redirect("/purchasing")
}

export async function createPurchaseRequestFromReorderSuggestion(formData: FormData) {
  const supabase = await createClient()
  const user = await requireUser()
  await requirePermission({ action: "request", resource: "purchasing" }, "/purchasing")

  const partId = String(formData.get("part_id") || "")
  if (!partId) purchasingRedirect("Part is required")

  const { data: suggestion, error: suggestionError } = await supabase
    .schema("ebiomed")
    .from("reorder_suggestions")
    .select("*")
    .eq("part_id", partId)
    .maybeSingle()

  if (suggestionError || !suggestion) {
    purchasingRedirect(suggestionError?.message || "Reorder suggestion not found")
  }

  const { data: part } = await supabase
    .from("parts")
    .select("*")
    .eq("id", partId)
    .single()

  const { data: latestPrice } = await supabase
    .schema("ebiomed")
    .from("supplier_price_history")
    .select("vendor_id, unit_price, lead_time_days")
    .eq("part_id", partId)
    .order("effective_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const pricing = selectPurchaseRequestPricing(suggestion, part as Part | null, latestPrice)
  const requestedQuantity = getReorderQuantity(suggestion)

  const reorderPolicy = purchaseApprovalPolicy(requestedQuantity * Number(pricing.estimatedUnitCost || 0))
  const { data, error } = await supabase
    .from("purchase_requests")
    .insert({
      part_id: partId,
      vendor_id: pricing.vendorId,
      requested_quantity: requestedQuantity,
      estimated_unit_cost: pricing.estimatedUnitCost,
      needed_by: null,
      source: "reorder_suggestion",
      approval_level: reorderPolicy.approvalLevel,
      approval_threshold_exceeded: reorderPolicy.thresholdExceeded,
      reason: `Low stock reorder for ${suggestion.name}`,
      requested_by: user.id,
    })
    .select()
    .single()

  if (error) purchasingRedirect(error.message)

  await logAudit("purchase_requests", data.id, "insert", [
    {
      newValue: JSON.stringify({
        part_id: partId,
        requested_quantity: requestedQuantity,
        estimated_unit_cost: pricing.estimatedUnitCost,
        vendor_id: pricing.vendorId,
        approval_level: reorderPolicy.approvalLevel,
        approval_threshold_exceeded: reorderPolicy.thresholdExceeded,
      }),
    },
  ], "Purchase request created from reorder suggestion")

  revalidatePath("/purchasing")
  revalidatePath("/parts")
  revalidatePath("/dashboard")
  redirect("/purchasing")
}

export async function approvePurchaseRequest(formData: FormData) {
  const supabase = await createClient()
  const user = await requireUser()
  await requirePermission({ action: "approve", resource: "purchasing" }, "/purchasing")
  const raw = cleanRecord(Object.fromEntries(formData))
  const parsed = purchaseRequestDecisionSchema.safeParse(raw)

  if (!parsed.success) purchasingRedirect(parsed.error.issues.map((e) => e.message).join(", "))

  const { data: request } = await supabase
    .from("purchase_requests")
    .select("approval_level, approval_threshold_exceeded, approved_by")
    .eq("id", parsed.data.id)
    .single()

  if (request?.approval_threshold_exceeded && request.approved_by === user.id) {
    purchasingRedirect("A second approver must be a different user")
  }

  const firstThresholdApproval = request?.approval_threshold_exceeded && !request.approved_by
  const secondThresholdApproval = request?.approval_threshold_exceeded && request.approved_by && request.approved_by !== user.id

  const updatePayload = firstThresholdApproval
    ? {
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    : {
      status: "approved",
      approved_by: request?.approved_by || user.id,
      approved_at: request?.approved_by ? undefined : new Date().toISOString(),
      second_approved_by: secondThresholdApproval ? user.id : null,
      second_approved_at: secondThresholdApproval ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }

  const { error } = await supabase
    .from("purchase_requests")
    .update(updatePayload)
    .eq("id", parsed.data.id)
    .eq("status", "pending_approval")

  if (error) purchasingRedirect(error.message)

  await logAudit("purchase_requests", parsed.data.id, "update", [
    { field: firstThresholdApproval ? "approved_by" : "status", oldValue: firstThresholdApproval ? null : "pending_approval", newValue: firstThresholdApproval ? user.id : "approved" }
  ], parsed.data.reason || (firstThresholdApproval ? "Purchase request first approval recorded" : "Purchase request approved"))

  revalidatePath("/purchasing")
  redirect("/purchasing")
}

export async function rejectPurchaseRequest(formData: FormData) {
  const supabase = await createClient()
  const user = await requireUser()
  await requirePermission({ action: "approve", resource: "purchasing" }, "/purchasing")
  const raw = cleanRecord(Object.fromEntries(formData))
  const parsed = purchaseRequestDecisionSchema.safeParse(raw)

  if (!parsed.success) purchasingRedirect(parsed.error.issues.map((e) => e.message).join(", "))

  const { error } = await supabase
    .from("purchase_requests")
    .update({
      status: "rejected",
      rejected_by: user.id,
      rejected_at: new Date().toISOString(),
      rejection_reason: parsed.data.reason || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.id)
    .in("status", ["pending_approval", "approved"])

  if (error) purchasingRedirect(error.message)

  await logAudit("purchase_requests", parsed.data.id, "update", [
    { field: "status", newValue: "rejected" }
  ], parsed.data.reason || "Purchase request rejected")

  revalidatePath("/purchasing")
  redirect("/purchasing")
}

export async function createPurchaseOrderFromRequest(formData: FormData) {
  const supabase = await createClient()
  const user = await requireUser()
  await requirePermission({ action: "write", resource: "purchasing" }, "/purchasing")
  const raw = cleanRecord(Object.fromEntries(formData))
  const parsed = createPurchaseOrderSchema.safeParse(raw)

  if (!parsed.success) purchasingRedirect(parsed.error.issues.map((e) => e.message).join(", "))

  const { data: request, error: requestError } = await supabase
    .from("purchase_requests")
    .select("*, part:parts(*)")
    .eq("id", parsed.data.purchase_request_id)
    .single()

  if (requestError || !request) purchasingRedirect(requestError?.message || "Purchase request not found")
  if (request.status !== "approved") purchasingRedirect("Only approved purchase requests can become purchase orders")

  const part = request.part as Part | null
  const vendorId = request.vendor_id || part?.preferred_vendor_id
  if (!vendorId) purchasingRedirect("Select a vendor before creating a purchase order")

  const unitCost = Number(request.estimated_unit_cost ?? part?.vendor_price ?? part?.unit_cost ?? 0)
  const totalAmount = Number(request.requested_quantity) * unitCost

  const { data: po, error: poError } = await supabase
    .from("purchase_orders")
    .insert({
      vendor_id: vendorId,
      purchase_request_id: request.id,
      ordered_by: user.id,
      expected_delivery: parsed.data.expected_delivery || null,
      total_amount: totalAmount,
      notes: parsed.data.notes || null,
    })
    .select()
    .single()

  if (poError || !po) purchasingRedirect(poError?.message || "Could not create purchase order")

  const { error: lineError } = await supabase
    .from("purchase_order_lines")
    .insert({
      purchase_order_id: po.id,
      part_id: request.part_id,
      quantity_ordered: request.requested_quantity,
      unit_cost: unitCost,
      stock_location: part?.stock_location || part?.location || null,
    })

  if (lineError) purchasingRedirect(lineError.message)

  const { error: updateError } = await supabase
    .from("purchase_requests")
    .update({
      status: "converted",
      purchase_order_id: po.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", request.id)

  if (updateError) purchasingRedirect(updateError.message)

  await logAudit("purchase_orders", po.id, "insert", [
    { newValue: JSON.stringify({ purchase_request_id: request.id, total_amount: totalAmount }) }
  ], "Purchase order created from approved request")

  revalidatePath("/purchasing")
  redirect("/purchasing")
}

export async function receivePurchaseOrderLine(formData: FormData) {
  const supabase = await createClient()
  await requirePermission({ action: "receive", resource: "inventory" }, "/purchasing")
  const raw = cleanRecord(Object.fromEntries(formData))
  const parsed = receivePurchaseOrderLineSchema.safeParse(raw)

  if (!parsed.success) purchasingRedirect(parsed.error.issues.map((e) => e.message).join(", "))

  const { data: line, error: lineError } = await supabase
    .from("purchase_order_lines")
    .select("*, part:parts(quantity_on_hand)")
    .eq("id", parsed.data.purchase_order_line_id)
    .eq("purchase_order_id", parsed.data.purchase_order_id)
    .single()

  if (lineError || !line) purchasingRedirect(lineError?.message || "Purchase order line not found")

  const receipt = validatePurchaseOrderReceipt(
    Number(line.quantity_ordered),
    Number(line.quantity_received),
    parsed.data.quantity_received
  )
  if (!receipt.ok) purchasingRedirect(receipt.error)

  const newLineReceived = receipt.nextQuantityReceived
  const now = new Date().toISOString()

  const { error: lineUpdateError } = await supabase
    .from("purchase_order_lines")
    .update({ quantity_received: newLineReceived, updated_at: now })
    .eq("id", line.id)

  if (lineUpdateError) purchasingRedirect(lineUpdateError.message)

  const { data: stockLocation } = line.stock_location
    ? await supabase
      .schema("ebiomed")
      .from("stock_locations")
      .select("id")
      .eq("code", line.stock_location)
      .maybeSingle()
    : { data: null }

  const { error: receiptError } = await supabase
    .schema("ebiomed")
    .rpc("apply_inventory_transaction", {
      p_part_id: line.part_id,
      p_stock_location_id: stockLocation?.id || null,
      p_bin_code: line.stock_location || null,
      p_transaction_type: "receipt",
      p_quantity_delta: parsed.data.quantity_received,
      p_unit_cost: line.unit_cost,
      p_work_order_id: null,
      p_job_card_id: null,
      p_job_card_part_id: null,
      p_reference: "purchase_order_lines",
      p_reason: "Purchase order received into stock",
    })

  if (receiptError) purchasingRedirect(receiptError.message)

  const { data: lines, error: linesError } = await supabase
    .from("purchase_order_lines")
    .select("quantity_ordered, quantity_received")
    .eq("purchase_order_id", parsed.data.purchase_order_id)

  if (linesError) purchasingRedirect(linesError.message)

  const { error: poUpdateError } = await supabase
    .from("purchase_orders")
    .update({
      status: getPurchaseOrderStatusAfterReceipt(lines || []),
      updated_at: now,
    })
    .eq("id", parsed.data.purchase_order_id)

  if (poUpdateError) purchasingRedirect(poUpdateError.message)

  await logAudit("purchase_order_lines", line.id, "update", [
    { field: "quantity_received", oldValue: String(line.quantity_received), newValue: String(newLineReceived) },
    { field: "inventory_transaction", newValue: String(parsed.data.quantity_received) },
  ], "Purchase order received into stock")

  revalidatePath("/purchasing")
  revalidatePath("/parts")
  revalidatePath("/dashboard")
  redirect("/purchasing")
}

export async function createContract(formData: FormData) {
  await requirePermission({ action: "write", resource: "purchasing" }, "/purchasing")
  const supabase = await createClient()
  const raw = cleanRecord(Object.fromEntries(formData))
  const parsed = contractSchema.safeParse(raw)

  if (!parsed.success) purchasingRedirect(parsed.error.issues.map((e) => e.message).join(", "))

  const { data, error } = await supabase
    .from("contracts")
    .insert(parsed.data)
    .select()
    .single()

  if (error) purchasingRedirect(error.message)

  await logAudit("contracts", data.id, "insert", [
    { newValue: JSON.stringify({ contract_number: parsed.data.contract_number, contract_type: parsed.data.contract_type }) }
  ], "Contract created")

  revalidatePath("/purchasing")
  revalidatePath("/dashboard")
  redirect("/purchasing")
}

export async function addContractAsset(formData: FormData) {
  await requirePermission({ action: "write", resource: "purchasing" }, "/purchasing")
  const supabase = await createClient()
  const raw = cleanRecord(Object.fromEntries(formData))
  const parsed = contractAssetSchema.safeParse(raw)

  if (!parsed.success) purchasingRedirect(parsed.error.issues.map((e) => e.message).join(", "))

  const { data, error } = await supabase
    .from("contract_assets")
    .insert(parsed.data)
    .select()
    .single()

  if (error) purchasingRedirect(error.message)

  await logAudit("contract_assets", data.id, "insert", [
    { newValue: JSON.stringify({ contract_id: parsed.data.contract_id, equipment_id: parsed.data.equipment_id }) }
  ], "Asset added to contract")

  revalidatePath("/purchasing")
  revalidatePath("/dashboard")
  redirect("/purchasing")
}

export async function recordVendorPerformanceEvent(formData: FormData) {
  const supabase = await createClient()
  const user = await requireUser()
  await requirePermission({ action: "write", resource: "purchasing" }, "/purchasing")
  const raw = cleanRecord(Object.fromEntries(formData))
  const parsed = vendorPerformanceEventSchema.safeParse(raw)

  if (!parsed.success) purchasingRedirect(parsed.error.issues.map((e) => e.message).join(", "))

  const { data, error } = await supabase
    .from("vendor_performance_events")
    .insert({
      ...parsed.data,
      work_order_id: parsed.data.work_order_id || null,
      contract_id: parsed.data.contract_id || null,
      sla_met: parsed.data.sla_met === "" || parsed.data.sla_met == null ? null : parsed.data.sla_met === "true",
      repeat_failure: parsed.data.repeat_failure === "true",
      recorded_by: user.id,
    })
    .select()
    .single()

  if (error) purchasingRedirect(error.message)

  await logAudit("vendor_performance_events", data.id, "insert", [
    { newValue: JSON.stringify({ vendor_id: parsed.data.vendor_id, event_type: parsed.data.event_type }) }
  ], "Vendor performance recorded")

  revalidatePath("/purchasing")
  redirect("/purchasing")
}

export async function refreshContractStatuses() {
  const supabase = await createClient()
  const user = await requireUser()
  await requirePermission({ action: "write", resource: "purchasing" }, "/purchasing")

  const { data: contracts, error } = await supabase
    .from("contracts")
    .select("id, end_date, alert_days_before_expiry, status, expiry_alert_sent_at")
    .neq("status", "cancelled")

  if (error) purchasingRedirect(error.message)

  const now = new Date()
  let updated = 0
  for (const contract of contracts || []) {
    const nextStatus = getContractLifecycleStatus(contract, now)
    const update: Record<string, unknown> = {
      status_reviewed_at: now.toISOString(),
      updated_at: now.toISOString(),
    }

    if (nextStatus !== contract.status) {
      update.status = nextStatus
      if (nextStatus === "expiring" && !contract.expiry_alert_sent_at) {
        update.expiry_alert_sent_at = now.toISOString()
      }
    }

    const { error: updateError } = await supabase
      .from("contracts")
      .update(update)
      .eq("id", contract.id)

    if (updateError) purchasingRedirect(updateError.message)

    if (nextStatus !== contract.status) {
      updated++
      await logAudit("contracts", contract.id, "update", [
        { field: "status", oldValue: contract.status, newValue: nextStatus }
      ], "Contract lifecycle status refreshed")
    }
  }

  await logAudit("contracts", user.id, "update", [
    { field: "status_refresh", newValue: String(updated) }
  ], "Contract lifecycle status refresh completed")

  revalidatePath("/purchasing")
  revalidatePath("/dashboard")
  redirect("/purchasing")
}

export async function getPurchasingDashboard(): Promise<{
  vendors: Vendor[]
  parts: Part[]
  reorderSuggestions: ReorderSuggestion[]
  purchaseRequests: PurchaseRequest[]
  purchaseOrders: PurchaseOrder[]
  contracts: Contract[]
  equipment: Equipment[]
  vendorPerformance: VendorPerformanceSummary[]
}> {
  const supabase = await createClient()

  const [
    { data: vendors },
    { data: parts },
    { data: reorderSuggestions },
    { data: purchaseRequests },
    { data: purchaseOrders },
    { data: contracts },
    { data: equipment },
    { data: performanceEvents },
  ] = await Promise.all([
    supabase.from("vendors").select("*").is("deleted_at", null).order("name"),
    supabase.from("parts").select("*, preferred_vendor:vendors(*)").order("name"),
    supabase.schema("ebiomed").from("reorder_suggestions").select("*").order("name"),
    supabase
      .from("purchase_requests")
      .select("*, part:parts(*), vendor:vendors(*)")
      .order("created_at", { ascending: false }),
    supabase
      .from("purchase_orders")
      .select("*, vendor:vendors(*), lines:purchase_order_lines(*, part:parts(*))")
      .order("created_at", { ascending: false }),
    supabase
      .from("contracts")
      .select("*, vendor:vendors(*), assets:contract_assets(*, equipment:equipment(*))")
      .order("end_date", { ascending: true }),
    supabase.from("equipment").select("*").is("deleted_at", null).order("name"),
    supabase.from("vendor_performance_events").select("*, vendor:vendors(*)"),
  ])

  const performanceByVendor = new Map<string, VendorPerformanceSummary>()
  for (const event of performanceEvents || []) {
    const vendor = event.vendor as Vendor | null
    if (!vendor) continue

    const current = performanceByVendor.get(vendor.id) || {
      vendor,
      event_count: 0,
      average_response_hours: null,
      sla_hit_rate: null,
      total_cost: 0,
      repeat_failures: 0,
    }

    const responseEvents = (performanceEvents || []).filter((item) => item.vendor_id === vendor.id && item.response_time_hours != null)
    const slaEvents = (performanceEvents || []).filter((item) => item.vendor_id === vendor.id && item.sla_met != null)

    current.event_count += 1
    current.average_response_hours = responseEvents.length
      ? responseEvents.reduce((sum, item) => sum + Number(item.response_time_hours || 0), 0) / responseEvents.length
      : null
    current.sla_hit_rate = slaEvents.length
      ? (slaEvents.filter((item) => item.sla_met).length / slaEvents.length) * 100
      : null
    current.total_cost += Number(event.cost_amount || 0)
    current.repeat_failures += event.repeat_failure ? 1 : 0

    performanceByVendor.set(vendor.id, current)
  }

  return {
    vendors: (vendors || []) as Vendor[],
    parts: (parts || []) as Part[],
    reorderSuggestions: (reorderSuggestions || []) as ReorderSuggestion[],
    purchaseRequests: (purchaseRequests || []) as PurchaseRequest[],
    purchaseOrders: (purchaseOrders || []) as PurchaseOrder[],
    contracts: (contracts || []) as Contract[],
    equipment: (equipment || []) as Equipment[],
    vendorPerformance: Array.from(performanceByVendor.values()),
  }
}

export async function getVendors(): Promise<Vendor[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("vendors")
    .select("*")
    .is("deleted_at", null)
    .order("name")

  return (data || []) as Vendor[]
}

export async function getExpiringContracts(): Promise<Contract[]> {
  const supabase = await createClient()
  const today = new Date()
  const horizon = new Date(today)
  horizon.setDate(today.getDate() + 90)

  const { data } = await supabase
    .from("contracts")
    .select("*, vendor:vendors(*), assets:contract_assets(*, equipment:equipment(*))")
    .neq("status", "cancelled")
    .lte("end_date", horizon.toISOString().slice(0, 10))
    .order("end_date", { ascending: true })

  return (data || []).filter((contract) => {
    const endDate = new Date(contract.end_date)
    const alertStart = new Date(endDate)
    alertStart.setDate(endDate.getDate() - Number(contract.alert_days_before_expiry || 0))
    return today >= alertStart || endDate < today
  }) as Contract[]
}
