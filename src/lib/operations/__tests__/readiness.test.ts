import { describe, expect, it } from "vitest"
import { buildEnterpriseReadinessReport, getEnterpriseReadinessReport } from "@/lib/operations/readiness"

describe("enterprise readiness", () => {
  it("reports ready when at least 95 percent of capabilities are implemented", () => {
    const report = getEnterpriseReadinessReport()

    expect(report.status).toBe("ready")
    expect(report.score).toBeGreaterThanOrEqual(95)
    expect(report.total).toBeGreaterThanOrEqual(12)
  })

  it("reports partial or blocked below the readiness target", () => {
    expect(buildEnterpriseReadinessReport([
      { id: "a", label: "A", implemented: true, evidence: "done" },
      { id: "b", label: "B", implemented: false, evidence: "missing" },
    ])).toMatchObject({ status: "blocked", score: 50 })
  })
})
