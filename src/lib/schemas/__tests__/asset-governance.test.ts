import { describe, expect, it } from "vitest"
import {
  commissioningRecordSchema,
  cybersecurityAssessmentSchema,
  decommissioningRecordSchema,
} from "@/lib/schemas/asset-governance"

const equipment_id = "11111111-1111-4111-8111-111111111111"

describe("asset governance schemas", () => {
  it("requires risk acceptance reason and expiry when cyber risk acceptance is required", () => {
    const result = cybersecurityAssessmentSchema.safeParse({
      equipment_id,
      assessment_status: "risk_acceptance_required",
      patch_status: "unsupported",
      antivirus_status: "unsupported",
      backup_status: "missing",
      assessment_notes: "Unsupported operating system",
    })
    expect(result.success).toBe(false)
  })

  it("approves commissioning only when all required evidence is complete", () => {
    expect(commissioningRecordSchema.safeParse({
      equipment_id,
      commissioning_status: "approved_for_service",
      installation_verified: "true",
      acceptance_test_passed: "true",
      user_training_completed: "true",
      handover_completed: "true",
      evidence_notes: "All commissioning evidence checked",
      reauth_password: "password123",
    }).success).toBe(true)

    expect(commissioningRecordSchema.safeParse({
      equipment_id,
      commissioning_status: "approved_for_service",
      installation_verified: "true",
      evidence_notes: "Partial evidence",
    }).success).toBe(false)
  })

  it("requires decommissioning re-authentication and hazard check", () => {
    const result = decommissioningRecordSchema.safeParse({
      equipment_id,
      disposal_method: "Vendor take-back",
      data_sanitization_status: "completed",
      accessories_recovered: "true",
      evidence_notes: "Ready to decommission",
      reauth_password: "password123",
    })
    expect(result.success).toBe(false)
  })
})
