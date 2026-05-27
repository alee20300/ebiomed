import { describe, it, expect } from "vitest"
import { equipmentSchema } from "@/lib/schemas/equipment"

describe("equipmentSchema", () => {
  const validData = {
    tag_number: "BM-001",
    name: "Ventilator V500",
    reason: "Adding new equipment to registry",
  }

  it("validates with minimum required fields", () => {
    const result = equipmentSchema.safeParse(validData)
    expect(result.success).toBe(true)
  })

  it("defaults status to active", () => {
    const result = equipmentSchema.safeParse(validData)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.status).toBe("active")
    }
  })

  it("rejects empty tag_number", () => {
    const result = equipmentSchema.safeParse({ ...validData, tag_number: "" })
    expect(result.success).toBe(false)
  })

  it("rejects empty name", () => {
    const result = equipmentSchema.safeParse({ ...validData, name: "" })
    expect(result.success).toBe(false)
  })

  it("rejects reason shorter than 5 characters", () => {
    const result = equipmentSchema.safeParse({ ...validData, reason: "Fix" })
    expect(result.success).toBe(false)
  })

  it("rejects reason longer than 500 characters", () => {
    const result = equipmentSchema.safeParse({ ...validData, reason: "x".repeat(501) })
    expect(result.success).toBe(false)
  })

  it("validates valid status values", () => {
    const statuses = ["active", "inactive", "retired", "under_repair", "out_of_tolerance", "certified"]
    for (const status of statuses) {
      const result = equipmentSchema.safeParse({ ...validData, status })
      expect(result.success).toBe(true)
    }
  })

  it("accepts optional fields", () => {
    const result = equipmentSchema.safeParse({
      ...validData,
      serial_number: "SN-123",
      model: "V500",
      manufacturer: "Drager",
      department: "ICU",
      location: "Room 101",
      category: "Ventilator",
      install_date: "2024-01-15",
      warranty_expiry: "2026-01-15",
      notes: "Test equipment",
    })
    expect(result.success).toBe(true)
  })
})
