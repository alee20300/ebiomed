import type { Equipment } from "@/lib/types"

export type LifecycleAsset = Pick<
  Equipment,
  | "acquisition_date"
  | "install_date"
  | "warranty_expiry"
  | "purchase_cost"
  | "expected_life_years"
  | "residual_value"
  | "current_value"
  | "depreciation_method"
  | "replacement_target_date"
  | "lifecycle_stage"
  | "patient_impact"
  | "downtime_impact"
  | "utilization"
  | "regulatory_class"
  | "maintenance_burden"
  | "support_expiry"
>

export interface AssetServiceSummary {
  workOrderCount: number
  completedCount: number
  openCount: number
  downtimeMinutes: number
  serviceCost: number
}

export interface ReplacementRecommendation {
  status: "monitor" | "plan" | "replace"
  label: string
  reasons: string[]
}

export interface AssetLifecycleSnapshot {
  lifecycle_risk_score: number
  lifecycle_risk_band: ReturnType<typeof getRiskBand>
  calculated_current_value: number | null
  service_cost_to_date: number
  downtime_minutes_to_date: number
  replacement_recommendation: ReplacementRecommendation["status"]
  replacement_recommendation_label: string
  replacement_recommendation_reasons: string[]
  lifecycle_reviewed_at: string
}

const RISK_WEIGHTS = {
  patient_impact: 0.3,
  downtime_impact: 0.2,
  utilization: 0.15,
  regulatory_class: 0.2,
  maintenance_burden: 0.15,
}

function parseDate(value: string | null | undefined) {
  return value ? new Date(value) : null
}

function yearsBetween(start: Date, end: Date) {
  return Math.max((end.getTime() - start.getTime()) / 31_557_600_000, 0)
}

function addYears(date: Date, years: number) {
  const next = new Date(date)
  next.setMonth(next.getMonth() + Math.round(years * 12))
  return next
}

export function getAssetAgeYears(equipment: Pick<LifecycleAsset, "acquisition_date" | "install_date">, now = new Date()) {
  const start = parseDate(equipment.acquisition_date || equipment.install_date)
  return start ? yearsBetween(start, now) : null
}

export function getUsefulLifeEndDate(equipment: Pick<LifecycleAsset, "acquisition_date" | "install_date" | "expected_life_years">) {
  const start = parseDate(equipment.acquisition_date || equipment.install_date)
  if (!start || !equipment.expected_life_years) return null
  return addYears(start, equipment.expected_life_years)
}

export function calculateRiskScore(equipment: Pick<Equipment, "patient_impact" | "downtime_impact" | "utilization" | "regulatory_class" | "maintenance_burden">) {
  const weighted =
    equipment.patient_impact * RISK_WEIGHTS.patient_impact +
    equipment.downtime_impact * RISK_WEIGHTS.downtime_impact +
    equipment.utilization * RISK_WEIGHTS.utilization +
    equipment.regulatory_class * RISK_WEIGHTS.regulatory_class +
    equipment.maintenance_burden * RISK_WEIGHTS.maintenance_burden

  return Math.round(weighted * 20)
}

export function getRiskBand(score: number) {
  if (score >= 80) return "Critical"
  if (score >= 60) return "High"
  if (score >= 40) return "Moderate"
  return "Low"
}

export function calculateCurrentValue(equipment: Pick<LifecycleAsset, "current_value" | "purchase_cost" | "expected_life_years" | "depreciation_method" | "residual_value" | "acquisition_date" | "install_date">, now = new Date()) {
  if (equipment.current_value !== null && equipment.current_value !== undefined) return Number(equipment.current_value)
  if (!equipment.purchase_cost || !equipment.expected_life_years || equipment.depreciation_method === "none") {
    return equipment.purchase_cost ? Number(equipment.purchase_cost) : null
  }

  const ageYears = getAssetAgeYears(equipment, now)
  if (ageYears === null) return Number(equipment.purchase_cost)

  const purchaseCost = Number(equipment.purchase_cost)
  const residualValue = Number(equipment.residual_value || 0)
  const depreciable = Math.max(purchaseCost - residualValue, 0)

  if (equipment.depreciation_method === "declining_balance") {
    const rate = Math.min(2 / equipment.expected_life_years, 1)
    return Math.max(purchaseCost * Math.pow(1 - rate, ageYears), residualValue)
  }

  const annualDepreciation = depreciable / equipment.expected_life_years
  return Math.max(purchaseCost - annualDepreciation * ageYears, residualValue)
}

export function getReplacementRecommendation(
  equipment: LifecycleAsset,
  serviceSummary: Pick<AssetServiceSummary, "serviceCost"> = { serviceCost: 0 },
  now = new Date()
): ReplacementRecommendation {
  const reasons: string[] = []
  const usefulLifeEnd = getUsefulLifeEndDate(equipment)
  const targetDate = parseDate(equipment.replacement_target_date)
  const supportExpiry = parseDate(equipment.support_expiry || equipment.warranty_expiry)
  const riskScore = calculateRiskScore(equipment)

  if (usefulLifeEnd && usefulLifeEnd < now) reasons.push("Past expected useful life")
  if (targetDate && targetDate < now) reasons.push("Past replacement target")
  if (supportExpiry && supportExpiry.getTime() - now.getTime() <= 90 * 86_400_000) reasons.push("Support or warranty expiring within 90 days")
  if (equipment.lifecycle_stage === "end_of_life" || equipment.lifecycle_stage === "limited_support") reasons.push("Lifecycle stage needs replacement planning")
  if (riskScore >= 80) reasons.push("Critical risk score")
  if (equipment.purchase_cost && serviceSummary.serviceCost / Number(equipment.purchase_cost) >= 0.25) {
    reasons.push("Maintenance cost exceeds 25% of purchase cost")
  }

  if (reasons.some((reason) => reason.includes("Past")) || equipment.lifecycle_stage === "end_of_life") {
    return { status: "replace", label: "Replace", reasons }
  }

  if (reasons.length > 0) return { status: "plan", label: "Plan replacement", reasons }

  return { status: "monitor", label: "Monitor", reasons: ["No immediate replacement trigger"] }
}

export function buildAssetLifecycleSnapshot(
  equipment: LifecycleAsset & Pick<Equipment, "patient_impact" | "downtime_impact" | "utilization" | "regulatory_class" | "maintenance_burden">,
  serviceSummary: AssetServiceSummary,
  now = new Date()
): AssetLifecycleSnapshot {
  const riskScore = calculateRiskScore(equipment)
  const recommendation = getReplacementRecommendation(equipment, serviceSummary, now)

  return {
    lifecycle_risk_score: riskScore,
    lifecycle_risk_band: getRiskBand(riskScore),
    calculated_current_value: calculateCurrentValue(equipment, now),
    service_cost_to_date: serviceSummary.serviceCost,
    downtime_minutes_to_date: serviceSummary.downtimeMinutes,
    replacement_recommendation: recommendation.status,
    replacement_recommendation_label: recommendation.label,
    replacement_recommendation_reasons: recommendation.reasons,
    lifecycle_reviewed_at: now.toISOString(),
  }
}
