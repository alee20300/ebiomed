import type { Part, ReorderSuggestion } from "@/lib/types"

export interface SupplierPriceCandidate {
  vendor_id: string | null
  unit_price: number | null
  lead_time_days: number | null
}

export function getReorderQuantity(row: Pick<ReorderSuggestion, "quantity_on_hand" | "min_threshold" | "reorder_quantity">) {
  return Math.max(Number(row.reorder_quantity || 0), Number(row.min_threshold || 0) * 2 - Number(row.quantity_on_hand || 0), 1)
}

export function selectPurchaseRequestPricing(
  suggestion: Pick<ReorderSuggestion, "preferred_vendor_id" | "vendor_price" | "latest_supplier_price">,
  part: Pick<Part, "unit_cost" | "vendor_price" | "preferred_vendor_id"> | null,
  latestPrice?: SupplierPriceCandidate | null
) {
  const vendorId = latestPrice?.vendor_id || suggestion.preferred_vendor_id || part?.preferred_vendor_id || null
  const estimatedUnitCost = Number(
    latestPrice?.unit_price
      ?? suggestion.latest_supplier_price
      ?? suggestion.vendor_price
      ?? part?.vendor_price
      ?? part?.unit_cost
      ?? 0
  )

  return {
    vendorId,
    estimatedUnitCost: Number.isFinite(estimatedUnitCost) ? estimatedUnitCost : 0,
  }
}

export function validatePurchaseOrderReceipt(quantityOrdered: number, quantityReceived: number, receivingNow: number) {
  const remaining = Number(quantityOrdered) - Number(quantityReceived)
  if (receivingNow < 1) return { ok: false as const, error: "Receive at least 1" }
  if (receivingNow > remaining) {
    return {
      ok: false as const,
      error: `Only ${remaining} unit${remaining === 1 ? "" : "s"} remaining to receive`,
    }
  }
  return {
    ok: true as const,
    remaining,
    nextQuantityReceived: Number(quantityReceived) + receivingNow,
  }
}

export function getPurchaseOrderStatusAfterReceipt(lines: Array<{ quantity_ordered: number; quantity_received: number }>) {
  const allReceived = lines.every((line) => Number(line.quantity_received) >= Number(line.quantity_ordered))
  const anyReceived = lines.some((line) => Number(line.quantity_received) > 0)
  return allReceived ? "received" : anyReceived ? "partially_received" : "issued"
}

export function calculateInventoryValue(quantityOnHand: number, unitCost: number | null | undefined) {
  return Number(quantityOnHand || 0) * Number(unitCost || 0)
}

export function getContractLifecycleStatus(contract: {
  end_date: string
  alert_days_before_expiry: number
  status?: string
}, now = new Date()): "active" | "expiring" | "expired" | "cancelled" {
  if (contract.status === "cancelled") return "cancelled"
  const endDate = new Date(`${contract.end_date}T23:59:59.999Z`)
  if (endDate < now) return "expired"

  const alertStart = new Date(endDate)
  alertStart.setUTCDate(alertStart.getUTCDate() - Number(contract.alert_days_before_expiry || 0))
  return now >= alertStart ? "expiring" : "active"
}
