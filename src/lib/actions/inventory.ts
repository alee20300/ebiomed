"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { logAudit } from "@/lib/actions/audit"
import { getCurrentUser } from "@/lib/actions/profiles"
import { requirePermission } from "@/lib/actions/permissions"
import { validateStockMovementAvailability } from "@/lib/utils/inventory"
import type {
  CycleCount,
  InventoryTransaction,
  InventoryValuationRow,
  LowStockRow,
  PartStockBalance,
  ReorderSuggestion,
  StockLocation,
} from "@/lib/types"

async function requireInventoryUser() {
  const user = await getCurrentUser()
  if (!user || user.role === "viewer") {
    return redirect(`/dashboard?error=${encodeURIComponent("Inventory access required")}`)
  }
  return user
}

function numberValue(formData: FormData, key: string, fallback = 0) {
  const value = formData.get(key)
  if (value == null || value === "") return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function optionalString(formData: FormData, key: string) {
  const value = String(formData.get(key) || "").trim()
  return value || null
}

async function getAvailableStock(
  supabase: Awaited<ReturnType<typeof createClient>>,
  partId: string,
  stockLocationId: string | null,
  binCode: string | null,
) {
  if (!stockLocationId) {
    const { data } = await supabase
      .schema("ebiomed")
      .from("parts")
      .select("quantity_on_hand")
      .eq("id", partId)
      .maybeSingle()
    return Number(data?.quantity_on_hand || 0)
  }

  let query = supabase
    .schema("ebiomed")
    .from("part_stock_balances")
    .select("quantity_on_hand")
    .eq("part_id", partId)
    .eq("stock_location_id", stockLocationId)

  if (binCode) {
    query = query.eq("bin_code", binCode)
  }

  const { data } = await query
  return (data || []).reduce((total, row) => total + Number(row.quantity_on_hand || 0), 0)
}

async function validateStockDecrease(
  supabase: Awaited<ReturnType<typeof createClient>>,
  partId: string,
  stockLocationId: string | null,
  binCode: string | null,
  requestedDecrease: number,
) {
  const available = await getAvailableStock(supabase, partId, stockLocationId, binCode)
  return validateStockMovementAvailability(available, requestedDecrease)
}

export async function getInventoryDashboard() {
  const supabase = await createClient()
  const [
    { data: locations },
    { data: balances },
    { data: transactions },
    { data: valuation },
    { data: lowStock },
    { data: reorderSuggestions },
    { data: cycleCounts },
  ] = await Promise.all([
    supabase.schema("ebiomed").from("stock_locations").select("*").order("name"),
    supabase
      .schema("ebiomed")
      .from("part_stock_balances")
      .select("*, part:part_id(name, part_number), stock_location:stock_location_id(name, code)")
      .order("updated_at", { ascending: false }),
    supabase
      .schema("ebiomed")
      .from("inventory_transactions")
      .select("*, part:part_id(name, part_number), stock_location:stock_location_id(name, code)")
      .order("recorded_at", { ascending: false })
      .limit(25),
    supabase.schema("ebiomed").from("inventory_value_report").select("*").order("name"),
    supabase.schema("ebiomed").from("low_stock_report").select("*").order("name"),
    supabase.schema("ebiomed").from("reorder_suggestions").select("*").order("name"),
    supabase
      .schema("ebiomed")
      .from("cycle_counts")
      .select("*, part:part_id(name, part_number), stock_location:stock_location_id(name, code)")
      .order("counted_at", { ascending: false })
      .limit(10),
  ])

  return {
    locations: (locations || []) as StockLocation[],
    balances: (balances || []) as PartStockBalance[],
    transactions: (transactions || []) as InventoryTransaction[],
    valuation: (valuation || []) as InventoryValuationRow[],
    lowStock: (lowStock || []) as LowStockRow[],
    reorderSuggestions: (reorderSuggestions || []) as ReorderSuggestion[],
    cycleCounts: (cycleCounts || []) as CycleCount[],
  }
}

export async function createStockLocation(formData: FormData) {
  await requireInventoryUser()
  await requirePermission({ action: "write", resource: "inventory" }, "/parts")
  const supabase = await createClient()
  const code = String(formData.get("code") || "").trim().toUpperCase()
  const name = String(formData.get("name") || "").trim()
  if (!code || !name) return redirect(`/parts?error=${encodeURIComponent("Location code and name are required")}`)

  const { data, error } = await supabase
    .schema("ebiomed")
    .from("stock_locations")
    .insert({
      code,
      name,
      site: optionalString(formData, "site"),
      building: optionalString(formData, "building"),
      floor: optionalString(formData, "floor"),
      room: optionalString(formData, "room"),
    })
    .select()
    .single()

  if (error) return redirect(`/parts?error=${encodeURIComponent(error.message)}`)

  await logAudit("stock_locations", data.id, "insert", [{ newValue: JSON.stringify({ code, name }) }], "Stock location created")
  revalidatePath("/parts")
  redirect("/parts")
}

export async function adjustStock(formData: FormData) {
  const user = await requireInventoryUser()
  await requirePermission({ action: "write", resource: "inventory" }, "/parts")
  const supabase = await createClient()
  const partId = String(formData.get("part_id") || "")
  const stockLocationId = String(formData.get("stock_location_id") || "") || null
  const quantityDelta = numberValue(formData, "quantity_delta")
  const reason = String(formData.get("reason") || "").trim()
  if (!partId || quantityDelta === 0 || reason.length < 5) {
    return redirect(`/parts?error=${encodeURIComponent("Part, non-zero quantity, and reason are required")}`)
  }
  const binCode = optionalString(formData, "bin_code")
  if (quantityDelta < 0) {
    const validation = await validateStockDecrease(supabase, partId, stockLocationId, binCode, Math.abs(quantityDelta))
    if (!validation.valid) return redirect(`/parts?error=${encodeURIComponent(validation.message || "Insufficient stock")}`)
  }

  const { data: transactionId, error: txError } = await supabase
    .schema("ebiomed")
    .rpc("apply_inventory_transaction", {
      p_part_id: partId,
      p_stock_location_id: stockLocationId,
      p_bin_code: binCode,
      p_transaction_type: "adjustment",
      p_quantity_delta: quantityDelta,
      p_unit_cost: numberValue(formData, "unit_cost", NaN) || null,
      p_work_order_id: null,
      p_job_card_id: null,
      p_job_card_part_id: null,
      p_reference: "stock_adjustments",
      p_reason: reason,
    })

  if (txError) return redirect(`/parts?error=${encodeURIComponent(txError.message)}`)

  const { data, error } = await supabase
    .schema("ebiomed")
    .from("stock_adjustments")
    .insert({
      part_id: partId,
      stock_location_id: stockLocationId,
      bin_code: binCode,
      quantity_delta: quantityDelta,
      reason,
      transaction_id: transactionId,
      adjusted_by: user.id,
    })
    .select()
    .single()

  if (error) return redirect(`/parts?error=${encodeURIComponent(error.message)}`)

  await logAudit("stock_adjustments", data.id, "insert", [{ newValue: JSON.stringify({ partId, quantityDelta }) }], reason)
  revalidatePath("/parts")
  revalidatePath("/dashboard")
  redirect("/parts")
}

export async function recordCycleCount(formData: FormData) {
  const user = await requireInventoryUser()
  await requirePermission({ action: "count", resource: "inventory" }, "/parts")
  const supabase = await createClient()
  const partId = String(formData.get("part_id") || "")
  const stockLocationId = String(formData.get("stock_location_id") || "") || null
  const expectedQuantity = numberValue(formData, "expected_quantity")
  const countedQuantity = numberValue(formData, "counted_quantity")
  const variance = countedQuantity - expectedQuantity
  const reason = String(formData.get("reason") || "").trim()
  if (!partId || reason.length < 5) return redirect(`/parts?error=${encodeURIComponent("Part and reason are required")}`)
  const binCode = optionalString(formData, "bin_code")
  if (variance < 0) {
    const validation = await validateStockDecrease(supabase, partId, stockLocationId, binCode, Math.abs(variance))
    if (!validation.valid) return redirect(`/parts?error=${encodeURIComponent(validation.message || "Insufficient stock")}`)
  }

  const { data: transactionId, error: txError } = await supabase
    .schema("ebiomed")
    .rpc("apply_inventory_transaction", {
      p_part_id: partId,
      p_stock_location_id: stockLocationId,
      p_bin_code: binCode,
      p_transaction_type: "cycle_count",
      p_quantity_delta: variance,
      p_unit_cost: null,
      p_work_order_id: null,
      p_job_card_id: null,
      p_job_card_part_id: null,
      p_reference: "cycle_counts",
      p_reason: reason,
    })

  if (txError) return redirect(`/parts?error=${encodeURIComponent(txError.message)}`)

  const { data, error } = await supabase
    .schema("ebiomed")
    .from("cycle_counts")
    .insert({
      part_id: partId,
      stock_location_id: stockLocationId,
      bin_code: binCode,
      expected_quantity: expectedQuantity,
      counted_quantity: countedQuantity,
      variance,
      reason,
      transaction_id: transactionId,
      counted_by: user.id,
    })
    .select()
    .single()

  if (error) return redirect(`/parts?error=${encodeURIComponent(error.message)}`)

  await logAudit("cycle_counts", data.id, "insert", [{ newValue: JSON.stringify({ partId, expectedQuantity, countedQuantity }) }], reason)
  revalidatePath("/parts")
  redirect("/parts")
}

export async function transferStock(formData: FormData) {
  const user = await requireInventoryUser()
  await requirePermission({ action: "transfer", resource: "inventory" }, "/parts")
  const supabase = await createClient()
  const partId = String(formData.get("part_id") || "")
  const fromLocation = String(formData.get("from_stock_location_id") || "")
  const toLocation = String(formData.get("to_stock_location_id") || "")
  const quantity = numberValue(formData, "quantity")
  const reason = String(formData.get("reason") || "").trim()
  if (!partId || !fromLocation || !toLocation || quantity < 1 || reason.length < 5) {
    return redirect(`/parts?error=${encodeURIComponent("Part, locations, quantity, and reason are required")}`)
  }
  const fromBinCode = optionalString(formData, "from_bin_code")
  const toBinCode = optionalString(formData, "to_bin_code")
  const validation = await validateStockDecrease(supabase, partId, fromLocation, fromBinCode, quantity)
  if (!validation.valid) return redirect(`/parts?error=${encodeURIComponent(validation.message || "Insufficient stock")}`)

  const common = {
    p_part_id: partId,
    p_unit_cost: null,
    p_work_order_id: null,
    p_job_card_id: null,
    p_job_card_part_id: null,
    p_reference: "stock_transfers",
    p_reason: reason,
  }
  const { data: outTransactionId, error: outError } = await supabase
    .schema("ebiomed")
    .rpc("apply_inventory_transaction", {
      ...common,
      p_stock_location_id: fromLocation,
      p_bin_code: fromBinCode,
      p_transaction_type: "transfer_out",
      p_quantity_delta: -quantity,
    })
  if (outError) return redirect(`/parts?error=${encodeURIComponent(outError.message)}`)

  const { data: inTransactionId, error: inError } = await supabase
    .schema("ebiomed")
    .rpc("apply_inventory_transaction", {
      ...common,
      p_stock_location_id: toLocation,
      p_bin_code: toBinCode,
      p_transaction_type: "transfer_in",
      p_quantity_delta: quantity,
    })
  if (inError) return redirect(`/parts?error=${encodeURIComponent(inError.message)}`)

  const { data, error } = await supabase
    .schema("ebiomed")
    .from("stock_transfers")
    .insert({
      part_id: partId,
      from_stock_location_id: fromLocation,
      to_stock_location_id: toLocation,
      from_bin_code: fromBinCode,
      to_bin_code: toBinCode,
      quantity,
      reason,
      out_transaction_id: outTransactionId,
      in_transaction_id: inTransactionId,
      transferred_by: user.id,
    })
    .select()
    .single()

  if (error) return redirect(`/parts?error=${encodeURIComponent(error.message)}`)

  await logAudit("stock_transfers", data.id, "insert", [{ newValue: JSON.stringify({ partId, fromLocation, toLocation, quantity }) }], reason)
  revalidatePath("/parts")
  redirect("/parts")
}
