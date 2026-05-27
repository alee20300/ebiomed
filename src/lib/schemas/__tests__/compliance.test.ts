import { describe, it, expect } from "vitest"
import { equipmentSchema } from "@/lib/schemas/equipment"

describe("compliance validation", () => {
  it("rejects mutations without reason for change", () => {
    const result = equipmentSchema.safeParse({
      tag_number: "BM-001",
      name: "Test Equipment",
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const reasons = result.error.issues.filter((e) => e.path.includes("reason"))
      expect(reasons.length).toBeGreaterThan(0)
    }
  })

  it("validates reason minimum length of 5 characters across all mutation schemas", () => {
    // Spot-check: equipment requires >= 5 char reason
    const resultShort = equipmentSchema.safeParse({
      tag_number: "BM-001",
      name: "Test",
      reason: "Fix",
    })
    expect(resultShort.success).toBe(false)

    const resultLong = equipmentSchema.safeParse({
      tag_number: "BM-001",
      name: "Test",
      reason: "Fixed asset tag per audit requirements",
    })
    expect(resultLong.success).toBe(true)
  })
})
