import { describe, it, expect } from "vitest"
import { partSchema, partRestockSchema, partsUsageSchema } from "@/lib/schemas/parts"

describe("partSchema", () => {
  const validData = {
    name: "ECG Electrodes",
    quantity_on_hand: "100",
    min_threshold: "20",
    reason: "Initial stock entry for new part from supplier",
  }

  it("validates with required fields", () => {
    const result = partSchema.safeParse(validData)
    expect(result.success).toBe(true)
  })

  it("defaults min_threshold to 5", () => {
    const result = partSchema.safeParse({ name: "ECG Electrodes", quantity_on_hand: "50", reason: validData.reason })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.min_threshold).toBe(5)
    }
  })

  it("rejects empty name", () => {
    const result = partSchema.safeParse({ ...validData, name: "" })
    expect(result.success).toBe(false)
  })

  it("accepts optional fields", () => {
    const result = partSchema.safeParse({
      ...validData,
      part_number: "ECG-001",
      unit_cost: "2.50",
      supplier: "MedSupply Inc",
      location: "Shelf A3",
    })
    expect(result.success).toBe(true)
  })
})

describe("partRestockSchema", () => {
  it("validates restock data", () => {
    const result = partRestockSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      quantity: "10",
      reason: "Restocking after monthly inventory count",
    })
    expect(result.success).toBe(true)
  })

  it("rejects quantity less than 1", () => {
    const result = partRestockSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      quantity: "0",
      reason: "Restocking after monthly inventory count",
    })
    expect(result.success).toBe(false)
  })
})

describe("partsUsageSchema", () => {
  it("validates parts usage data", () => {
    const result = partsUsageSchema.safeParse({
      work_order_id: "550e8400-e29b-41d4-a716-446655440000",
      part_id: "660e8400-e29b-41d4-a716-446655440001",
      quantity_used: "2",
      reason: "Used parts for repair work order",
    })
    expect(result.success).toBe(true)
  })

  it("rejects quantity_used less than 1", () => {
    const result = partsUsageSchema.safeParse({
      work_order_id: "550e8400-e29b-41d4-a716-446655440000",
      part_id: "660e8400-e29b-41d4-a716-446655440001",
      quantity_used: "0",
      reason: "Used parts for repair work order",
    })
    expect(result.success).toBe(false)
  })
})
