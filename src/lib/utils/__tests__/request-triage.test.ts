import { describe, expect, it } from "vitest"
import { calculateRequestTriage, requestWorkflowStatus } from "@/lib/utils/request-triage"

describe("calculateRequestTriage", () => {
  const submittedAt = new Date("2026-08-12T08:00:00.000Z")

  it("sets critical priority and short SLA when patient safety is critical", () => {
    const decision = calculateRequestTriage({
      urgency: "normal",
      patientSafetyRisk: "critical",
      clinicalImpact: "routine",
      patientCareCritical: false,
      assetCriticality: "medium",
      submittedAt,
    })

    expect(decision.workOrderPriority).toBe("critical")
    expect(decision.responseDueAt.toISOString()).toBe("2026-08-12T09:00:00.000Z")
    expect(decision.resolutionDueAt.toISOString()).toBe("2026-08-12T16:00:00.000Z")
  })

  it("promotes life support assets to critical even with normal urgency", () => {
    const decision = calculateRequestTriage({
      urgency: "normal",
      patientSafetyRisk: "low",
      clinicalImpact: "routine",
      patientCareCritical: false,
      assetCriticality: "life_support",
      submittedAt,
    })

    expect(decision.workOrderPriority).toBe("critical")
  })

  it("sets high priority for urgent requests", () => {
    const decision = calculateRequestTriage({
      urgency: "urgent",
      patientSafetyRisk: "medium",
      clinicalImpact: "care_delayed",
      patientCareCritical: false,
      assetCriticality: "medium",
      submittedAt,
    })

    expect(decision.workOrderPriority).toBe("high")
    expect(decision.responseDueAt.toISOString()).toBe("2026-08-12T12:00:00.000Z")
    expect(decision.resolutionDueAt.toISOString()).toBe("2026-08-13T08:00:00.000Z")
  })

  it("allows low priority for no-impact low urgency requests", () => {
    const decision = calculateRequestTriage({
      urgency: "low",
      patientSafetyRisk: "none",
      clinicalImpact: "none",
      patientCareCritical: false,
      assetCriticality: "low",
      submittedAt,
    })

    expect(decision.workOrderPriority).toBe("low")
    expect(decision.responseDueAt.toISOString()).toBe("2026-08-14T08:00:00.000Z")
    expect(decision.resolutionDueAt.toISOString()).toBe("2026-08-19T08:00:00.000Z")
  })
})

describe("requestWorkflowStatus", () => {
  it("uses explicit request status first", () => {
    expect(requestWorkflowStatus({ status: "pending_review", request_status: "triaged" })).toBe("triaged")
  })

  it("falls back to converted work order for older rows", () => {
    expect(requestWorkflowStatus({ status: "approved", converted_work_order_id: "wo-1" })).toBe("converted")
  })
})
