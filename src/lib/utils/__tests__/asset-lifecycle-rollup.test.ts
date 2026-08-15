import { describe, expect, it } from "vitest"
import { buildAssetLifecycleSnapshot, type AssetServiceSummary, type LifecycleAsset } from "@/lib/utils/asset-lifecycle"

const baseAsset: LifecycleAsset = {
  acquisition_date: "2020-01-01",
  install_date: "2020-02-01",
  warranty_expiry: "2026-12-31",
  purchase_cost: 100000,
  expected_life_years: 10,
  residual_value: 10000,
  current_value: null,
  depreciation_method: "straight_line",
  replacement_target_date: "2030-01-01",
  lifecycle_stage: "in_service",
  patient_impact: 3,
  downtime_impact: 3,
  utilization: 3,
  regulatory_class: 3,
  maintenance_burden: 3,
  support_expiry: "2027-12-31",
}

const baseSummary: AssetServiceSummary = {
  workOrderCount: 3,
  completedCount: 2,
  openCount: 1,
  downtimeMinutes: 120,
  serviceCost: 5000,
}

describe("buildAssetLifecycleSnapshot", () => {
  it("creates queryable lifecycle rollup fields", () => {
    const snapshot = buildAssetLifecycleSnapshot(baseAsset, baseSummary, new Date("2026-01-01T00:00:00.000Z"))

    expect(snapshot.lifecycle_risk_score).toBe(60)
    expect(snapshot.lifecycle_risk_band).toBe("High")
    expect(snapshot.service_cost_to_date).toBe(5000)
    expect(snapshot.downtime_minutes_to_date).toBe(120)
    expect(snapshot.replacement_recommendation).toBe("monitor")
    expect(snapshot.lifecycle_reviewed_at).toBe("2026-01-01T00:00:00.000Z")
  })

  it("recommends replacement when asset is past useful life", () => {
    const snapshot = buildAssetLifecycleSnapshot(
      { ...baseAsset, expected_life_years: 5 },
      baseSummary,
      new Date("2026-01-01T00:00:00.000Z")
    )

    expect(snapshot.replacement_recommendation).toBe("replace")
    expect(snapshot.replacement_recommendation_reasons).toContain("Past expected useful life")
  })
})
