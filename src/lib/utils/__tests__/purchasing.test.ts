import { describe, expect, it } from "vitest"
import {
  calculateInventoryValue,
  getContractLifecycleStatus,
  getPurchaseOrderStatusAfterReceipt,
  getReorderQuantity,
  selectPurchaseRequestPricing,
  validatePurchaseOrderReceipt,
} from "@/lib/utils/purchasing"

describe("purchasing helpers", () => {
  it("uses explicit reorder quantity and falls back to min-stock coverage", () => {
    expect(getReorderQuantity({ quantity_on_hand: 2, min_threshold: 5, reorder_quantity: 12 })).toBe(12)
    expect(getReorderQuantity({ quantity_on_hand: 2, min_threshold: 5, reorder_quantity: 0 })).toBe(8)
    expect(getReorderQuantity({ quantity_on_hand: 5, min_threshold: 5, reorder_quantity: 0 })).toBe(5)
  })

  it("prefers latest supplier price before older part-level pricing", () => {
    expect(selectPurchaseRequestPricing(
      { preferred_vendor_id: "vendor-1", vendor_price: 12, latest_supplier_price: 10 },
      { preferred_vendor_id: "vendor-2", vendor_price: 14, unit_cost: 20 },
      { vendor_id: "vendor-3", unit_price: 8, lead_time_days: 3 }
    )).toEqual({ vendorId: "vendor-3", estimatedUnitCost: 8 })
  })

  it("falls back through suggestion and part defaults", () => {
    expect(selectPurchaseRequestPricing(
      { preferred_vendor_id: null, vendor_price: null, latest_supplier_price: null },
      { preferred_vendor_id: "vendor-2", vendor_price: null, unit_cost: 20 }
    )).toEqual({ vendorId: "vendor-2", estimatedUnitCost: 20 })
  })

  it("validates partial receipt and rejects over-receipt", () => {
    expect(validatePurchaseOrderReceipt(10, 4, 3)).toEqual({
      ok: true,
      remaining: 6,
      nextQuantityReceived: 7,
    })
    expect(validatePurchaseOrderReceipt(10, 4, 7)).toEqual({
      ok: false,
      error: "Only 6 units remaining to receive",
    })
  })

  it("computes purchase order status after line receipts", () => {
    expect(getPurchaseOrderStatusAfterReceipt([{ quantity_ordered: 10, quantity_received: 4 }])).toBe("partially_received")
    expect(getPurchaseOrderStatusAfterReceipt([{ quantity_ordered: 10, quantity_received: 10 }])).toBe("received")
    expect(getPurchaseOrderStatusAfterReceipt([{ quantity_ordered: 10, quantity_received: 0 }])).toBe("issued")
  })

  it("calculates inventory valuation from stock balance and unit cost", () => {
    expect(calculateInventoryValue(8, 12.5)).toBe(100)
    expect(calculateInventoryValue(8, null)).toBe(0)
  })

  it("classifies contract lifecycle status from alert window", () => {
    const now = new Date("2026-08-13T00:00:00.000Z")
    expect(getContractLifecycleStatus({ end_date: "2026-12-31", alert_days_before_expiry: 30 }, now)).toBe("active")
    expect(getContractLifecycleStatus({ end_date: "2026-08-20", alert_days_before_expiry: 30 }, now)).toBe("expiring")
    expect(getContractLifecycleStatus({ end_date: "2026-08-01", alert_days_before_expiry: 30 }, now)).toBe("expired")
    expect(getContractLifecycleStatus({ end_date: "2026-08-01", alert_days_before_expiry: 30, status: "cancelled" }, now)).toBe("cancelled")
  })
})
