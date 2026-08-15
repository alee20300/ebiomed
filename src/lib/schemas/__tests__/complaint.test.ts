import { describe, expect, it } from "vitest"
import { requestTriageSchema } from "@/lib/schemas/complaint"

describe("requestTriageSchema", () => {
  const validData = {
    urgency: "urgent",
    clinical_impact: "patient_at_risk",
    patient_safety_risk: "high",
    patient_care_critical: "on",
    duplicate_of: "none",
    triage_notes: "Ventilator failure needs immediate biomedical response",
  }

  it("validates triage fields and normalizes empty duplicate", () => {
    const result = requestTriageSchema.safeParse(validData)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.patient_care_critical).toBe(true)
      expect(result.data.duplicate_of).toBeNull()
    }
  })

  it("rejects invalid safety risk", () => {
    const result = requestTriageSchema.safeParse({
      ...validData,
      patient_safety_risk: "severe",
    })

    expect(result.success).toBe(false)
  })

  it("requires actionable triage notes", () => {
    const result = requestTriageSchema.safeParse({
      ...validData,
      triage_notes: "ok",
    })

    expect(result.success).toBe(false)
  })
})
