import { describe, expect, it } from "vitest"
import { pmOccurrenceSkipSchema, pmScheduleSchema } from "@/lib/schemas/pm-schedule"

describe("pmScheduleSchema advanced PM fields", () => {
  const validData = {
    equipment_id: "550e8400-e29b-41d4-a716-446655440000",
    frequency_days: 30,
    trigger_type: "calendar",
    calendar_interval_days: 30,
    risk_modifier: 1,
    grace_period_days: 2,
    escalation_assignee_after_days: 0,
    escalation_admin_after_days: 2,
    escalation_department_after_days: 5,
    reason: "Create advanced PM schedule",
  }

  it("accepts ordered escalation thresholds", () => {
    expect(pmScheduleSchema.safeParse(validData).success).toBe(true)
  })

  it("rejects admin escalation after department escalation", () => {
    const result = pmScheduleSchema.safeParse({
      ...validData,
      escalation_admin_after_days: 7,
      escalation_department_after_days: 5,
    })

    expect(result.success).toBe(false)
  })

  it("requires usage interval for run-hour PMs", () => {
    const result = pmScheduleSchema.safeParse({
      ...validData,
      trigger_type: "run_hours",
      meter_interval: undefined,
    })

    expect(result.success).toBe(false)
  })
})

describe("pmOccurrenceSkipSchema", () => {
  it("requires a meaningful skip reason", () => {
    expect(pmOccurrenceSkipSchema.safeParse({ reason: "ok" }).success).toBe(false)
    expect(pmOccurrenceSkipSchema.safeParse({ reason: "Vendor recall PM superseded this occurrence" }).success).toBe(true)
  })
})
