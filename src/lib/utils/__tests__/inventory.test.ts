import { describe, expect, it } from "vitest"
import { validateStockMovementAvailability } from "@/lib/utils/inventory"

describe("inventory helpers", () => {
  it("allows decreases within available stock", () => {
    expect(validateStockMovementAvailability(10, 4)).toEqual({ valid: true })
  })

  it("rejects decreases greater than available stock", () => {
    expect(validateStockMovementAvailability(3, 5)).toEqual({
      valid: false,
      message: "Insufficient stock: requested 5, available 3",
    })
  })

  it("rejects non-positive movement quantities", () => {
    expect(validateStockMovementAvailability(10, 0)).toEqual({
      valid: false,
      message: "Stock movement quantity must be greater than zero",
    })
  })
})
