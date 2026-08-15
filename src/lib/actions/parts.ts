"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { partSchema, partsUsageSchema } from "@/lib/schemas/parts"
import { getCurrentUser } from "@/lib/actions/profiles"
import { logAudit } from "@/lib/actions/audit"
import { hasPermission, requirePermission } from "@/lib/actions/permissions"
import type { Part } from "@/lib/types"
import type { PartsUsageDraftPayload } from "@/lib/offline/work-order-drafts"

export async function createPart(formData: FormData) {
  const supabase = await createClient()
  await requirePermission({ action: "write", resource: "parts" }, "/parts")
  const raw = Object.fromEntries(formData)
  const parsed = partSchema.safeParse(raw)

  if (!parsed.success) {
    const messages = parsed.error.issues.map((e) => e.message).join(", ")
    return redirect(`/parts?error=${encodeURIComponent(messages)}`)
  }

  const { reason, preferred_vendor_id, stock_location, max_threshold, reorder_quantity, ...partData } = parsed.data
  const payload = {
    ...partData,
    max_threshold: max_threshold ?? Math.max(parsed.data.min_threshold * 2, parsed.data.quantity_on_hand),
    reorder_quantity: reorder_quantity ?? Math.max(parsed.data.min_threshold, 1),
    preferred_vendor_id: preferred_vendor_id || null,
    stock_location: stock_location || parsed.data.location || null,
    quarantine_reason: parsed.data.quarantine_reason || null,
  }

  const { data, error } = await supabase.from("parts").insert(payload).select().single()
  if (error) {
    return redirect(`/parts?error=${encodeURIComponent(error.message)}`)
  }

  await logAudit("parts", data.id, "insert", [
    { newValue: JSON.stringify(payload) }
  ], reason || "Part created")

  const { data: location } = await supabase
    .schema("ebiomed")
    .from("stock_locations")
    .select("id")
    .eq("code", payload.stock_location || "MAIN")
    .maybeSingle()

  if (data.quantity_on_hand > 0) {
    await supabase.schema("ebiomed").rpc("apply_inventory_transaction", {
      p_part_id: data.id,
      p_stock_location_id: location?.id || null,
      p_bin_code: data.bin_code || payload.stock_location || null,
      p_transaction_type: "receipt",
      p_quantity_delta: data.quantity_on_hand,
      p_unit_cost: data.unit_cost || null,
      p_work_order_id: null,
      p_job_card_id: null,
      p_job_card_part_id: null,
      p_reference: "parts",
      p_reason: reason || "Initial stock",
    })
  }

  revalidatePath("/parts")
  revalidatePath("/dashboard")
  redirect("/parts")
}

export async function getParts(): Promise<Part[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("parts")
    .select("*, preferred_vendor:vendors(*)")
    .order("name")

  return (data || []) as Part[]
}

export async function restockPart(formData: FormData) {
  const supabase = await createClient()
  await requirePermission({ action: "restock", resource: "parts" }, "/parts")
  const raw = Object.fromEntries(formData)

  const { data: part, error: fetchError } = await supabase
    .from("parts")
    .select("quantity_on_hand, unit_cost")
    .eq("id", raw.id as string)
    .single()

  if (fetchError || !part) {
    return redirect("/parts?error=Part not found")
  }

  const newQuantity = part.quantity_on_hand + parseInt(raw.quantity as string, 10)

  const { data: balance } = await supabase
    .schema("ebiomed")
    .from("part_stock_balances")
    .select("stock_location_id, bin_code")
    .eq("part_id", raw.id as string)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  await supabase.schema("ebiomed").rpc("apply_inventory_transaction", {
    p_part_id: raw.id as string,
    p_stock_location_id: balance?.stock_location_id || null,
    p_bin_code: balance?.bin_code || null,
    p_transaction_type: "receipt",
    p_quantity_delta: parseInt(raw.quantity as string, 10),
    p_unit_cost: part.unit_cost || null,
    p_work_order_id: null,
    p_job_card_id: null,
    p_job_card_part_id: null,
    p_reference: "parts_restock",
    p_reason: (raw.reason as string) || "Restock",
  })

  await logAudit("parts", raw.id as string, "update", [
    { field: "quantity_on_hand", oldValue: String(part.quantity_on_hand), newValue: String(newQuantity) }
  ], (raw.reason as string) || "Restock")

  revalidatePath("/parts")
  redirect("/parts")
}

export async function consumeParts(formData: FormData) {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) return redirect("/login")
  await requirePermission({ action: "consume", resource: "parts" }, `/work-orders/${formData.get("work_order_id") || ""}`)

  const raw = Object.fromEntries(formData)
  const parsed = partsUsageSchema.safeParse(raw)

  if (!parsed.success) {
    const messages = parsed.error.issues.map((e) => e.message).join(", ")
    return redirect(`/work-orders/${raw.work_order_id}?error=${encodeURIComponent(messages)}`)
  }

  const { data: part } = await supabase
    .from("parts")
    .select("quarantine_status, expiry_date")
    .eq("id", parsed.data.part_id)
    .single()

  if (part?.quarantine_status && part.quarantine_status !== "released") {
    return redirect(`/work-orders/${raw.work_order_id}?error=${encodeURIComponent("Quarantined, expired, or recalled stock cannot be consumed")}`)
  }
  if (part?.expiry_date && new Date(part.expiry_date) < new Date()) {
    return redirect(`/work-orders/${raw.work_order_id}?error=${encodeURIComponent("Expired stock cannot be consumed")}`)
  }

  const { data, error } = await supabase.from("parts_usage").insert({
    ...parsed.data,
    used_by: user.id,
  }).select().single()

  if (error) {
    return redirect(`/work-orders/${raw.work_order_id}?error=${encodeURIComponent(error.message)}`)
  }

  await logAudit("parts_usage", data.id, "insert", [
    { newValue: JSON.stringify({ work_order_id: parsed.data.work_order_id, part_id: parsed.data.part_id, quantity_used: parsed.data.quantity_used }) }
  ], parsed.data.reason)

  revalidatePath("/parts")
  revalidatePath(`/work-orders/${raw.work_order_id}`)
  redirect(`/work-orders/${raw.work_order_id}`)
}

export async function syncOfflinePartsUsageDraft(payload: PartsUsageDraftPayload): Promise<{
  ok: boolean
  error?: string
}> {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: "Login is required before syncing this draft." }
  if (!(await hasPermission({ action: "consume", resource: "parts" }))) {
    return { ok: false, error: "You do not have permission for that action." }
  }

  const { data: workOrder } = await supabase
    .schema("ebiomed")
    .from("work_orders")
    .select("status")
    .eq("id", payload.workOrderId)
    .single()

  if (!workOrder) return { ok: false, error: "Work order no longer exists." }
  if (workOrder.status === "completed" || workOrder.status === "cancelled") {
    return { ok: false, error: "Work order was closed before this parts draft synced." }
  }

  const parsed = partsUsageSchema.safeParse({
    work_order_id: payload.workOrderId,
    part_id: payload.partId,
    quantity_used: payload.quantityUsed,
    reason: payload.reason,
  })

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((issue) => issue.message).join(", ") }
  }

  const { data: part } = await supabase
    .schema("ebiomed")
    .from("parts")
    .select("quarantine_status, expiry_date")
    .eq("id", parsed.data.part_id)
    .single()

  if (part?.quarantine_status && part.quarantine_status !== "released") {
    return { ok: false, error: "Quarantined, expired, or recalled stock cannot be consumed." }
  }
  if (part?.expiry_date && new Date(part.expiry_date) < new Date()) {
    return { ok: false, error: "Expired stock cannot be consumed." }
  }

  const { data, error } = await supabase.schema("ebiomed").from("parts_usage").insert({
    ...parsed.data,
    used_by: user.id,
  }).select("id").single()

  if (error) return { ok: false, error: error.message }

  await logAudit("parts_usage", data.id, "insert", [
    { newValue: JSON.stringify({ work_order_id: parsed.data.work_order_id, part_id: parsed.data.part_id, quantity_used: parsed.data.quantity_used }) },
  ], parsed.data.reason)

  revalidatePath("/parts")
  revalidatePath(`/work-orders/${payload.workOrderId}`)
  return { ok: true }
}
