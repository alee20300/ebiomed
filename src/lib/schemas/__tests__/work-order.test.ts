import { describe, it, expect } from "vitest"
import { workOrderSchema, workOrderUpdateSchema } from "@/lib/schemas/work-order"

describe("workOrderSchema", () => {
  const validData = {
    equipment_id: "550e8400-e29b-41d4-a716-446655440000",
    description: "Patient monitor displaying incorrect heart rate readings",
    reason: "Reported by nursing staff during morning rounds",
  }

  it("validates with minimum required fields", () => {
    const result = workOrderSchema.safeParse(validData)
    expect(result.success).toBe(true)
  })

  it("defaults type to corrective", () => {
    const result = workOrderSchema.safeParse(validData)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.type).toBe("corrective")
    }
  })

  it("defaults priority to medium", () => {
    const result = workOrderSchema.safeParse(validData)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.priority).toBe("medium")
    }
  })

  it("rejects empty description", () => {
    const result = workOrderSchema.safeParse({ ...validData, description: "" })
    expect(result.success).toBe(false)
  })

  it("rejects invalid equipment_id", () => {
    const result = workOrderSchema.safeParse({ ...validData, equipment_id: "not-a-uuid" })
    expect(result.success).toBe(false)
  })

  it("requires reason", () => {
    const result = workOrderSchema.safeParse({ equipment_id: validData.equipment_id, description: validData.description })
    expect(result.success).toBe(false)
  })

  it("accepts all valid types", () => {
    const types = ["corrective", "preventive"]
    for (const type of types) {
      const result = workOrderSchema.safeParse({ ...validData, type })
      expect(result.success).toBe(true)
    }
  })

  it("accepts all valid priorities", () => {
    const priorities = ["low", "medium", "high", "critical"]
    for (const p of priorities) {
      const result = workOrderSchema.safeParse({ ...validData, priority: p })
      expect(result.success).toBe(true)
    }
  })
})

describe("workOrderUpdateSchema", () => {
  it("allows partial updates", () => {
    const result = workOrderUpdateSchema.safeParse({
      status: "in_progress",
      reason: "Starting work on the equipment repair",
    })
    expect(result.success).toBe(true)
  })

  it("validates status transitions", () => {
    const statuses = ["open", "in_progress", "on_hold", "completed", "cancelled"]
    for (const status of statuses) {
      const result = workOrderUpdateSchema.safeParse({
        status,
        reason: "Valid reason for status change",
      })
      expect(result.success).toBe(true)
    }
  })

  it("rejects empty object without reason", () => {
    const result = workOrderUpdateSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})
