import { describe, expect, it } from "vitest"
import { faultReportWithCallLogSchema } from "@/lib/schemas/fault-report"

describe("faultReportWithCallLogSchema", () => {
  const validReport = {
    equipment_id: "a52caedf-8a86-48e3-9e41-cd975cf1a199",
    description: "Ventilator will not complete its startup sequence",
    called_department: "true",
    answered_by: "Ahmed Khan",
    call_status: "informed",
  }

  it.each(["informed", "not_picked"])("accepts %s call status", (callStatus) => {
    const result = faultReportWithCallLogSchema.safeParse({
      ...validReport,
      call_status: callStatus,
    })

    expect(result.success).toBe(true)
  })

  it("requires the called biomedical engineer", () => {
    const result = faultReportWithCallLogSchema.safeParse({
      ...validReport,
      answered_by: "",
    })

    expect(result.success).toBe(false)
  })

  it("rejects the legacy answered status", () => {
    const result = faultReportWithCallLogSchema.safeParse({
      ...validReport,
      call_status: "answered",
    })

    expect(result.success).toBe(false)
  })
})
