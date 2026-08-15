export interface StockMovementValidation {
  valid: boolean
  message?: string
}

export function validateStockMovementAvailability(
  availableQuantity: number,
  requestedDecrease: number,
): StockMovementValidation {
  const available = Math.max(0, Math.trunc(Number.isFinite(availableQuantity) ? availableQuantity : 0))
  const requested = Math.trunc(Number.isFinite(requestedDecrease) ? requestedDecrease : 0)

  if (requested <= 0) {
    return { valid: false, message: "Stock movement quantity must be greater than zero" }
  }

  if (requested > available) {
    return {
      valid: false,
      message: `Insufficient stock: requested ${requested}, available ${available}`,
    }
  }

  return { valid: true }
}
