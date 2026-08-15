import type { Equipment, WorkOrder } from "@/lib/types"

export const requestUrgencies = ["low", "normal", "urgent", "emergency"] as const
export const clinicalImpacts = ["none", "routine", "care_delayed", "patient_at_risk", "patient_harm"] as const
export const patientSafetyRisks = ["none", "low", "medium", "high", "critical"] as const
export const requestStatuses = ["new", "triaged", "approved", "rejected", "converted"] as const

export type RequestUrgency = (typeof requestUrgencies)[number]
export type ClinicalImpact = (typeof clinicalImpacts)[number]
export type PatientSafetyRisk = (typeof patientSafetyRisks)[number]
export type RequestStatus = (typeof requestStatuses)[number]

type AssetCriticality = Equipment["asset_criticality"] | null | undefined

export interface TriageInput {
  urgency: RequestUrgency
  patientSafetyRisk: PatientSafetyRisk
  clinicalImpact: ClinicalImpact
  patientCareCritical: boolean
  assetCriticality?: AssetCriticality
  submittedAt?: Date
}

export interface TriageDecision {
  workOrderPriority: WorkOrder["priority"]
  responseDueAt: Date
  resolutionDueAt: Date
}

const HOUR = 60 * 60 * 1000

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * HOUR)
}

export function calculateRequestTriage(input: TriageInput): TriageDecision {
  const submittedAt = input.submittedAt ?? new Date()
  const criticalSignals = [
    input.urgency === "emergency",
    input.patientSafetyRisk === "critical",
    input.clinicalImpact === "patient_harm",
    input.patientCareCritical,
    input.assetCriticality === "life_support",
  ]
  const highSignals = [
    input.urgency === "urgent",
    input.patientSafetyRisk === "high",
    input.clinicalImpact === "patient_at_risk",
    input.assetCriticality === "high",
  ]

  if (criticalSignals.some(Boolean)) {
    return {
      workOrderPriority: "critical",
      responseDueAt: addHours(submittedAt, 1),
      resolutionDueAt: addHours(submittedAt, 8),
    }
  }

  if (highSignals.some(Boolean)) {
    return {
      workOrderPriority: "high",
      responseDueAt: addHours(submittedAt, 4),
      resolutionDueAt: addHours(submittedAt, 24),
    }
  }

  if (input.urgency === "low" && input.patientSafetyRisk === "none" && input.clinicalImpact === "none") {
    return {
      workOrderPriority: "low",
      responseDueAt: addHours(submittedAt, 48),
      resolutionDueAt: addHours(submittedAt, 168),
    }
  }

  return {
    workOrderPriority: "medium",
    responseDueAt: addHours(submittedAt, 24),
    resolutionDueAt: addHours(submittedAt, 72),
  }
}

export function requestWorkflowStatus(complaint: {
  request_status?: RequestStatus | null
  converted_work_order_id?: string | null
  status: string
}) {
  if (complaint.request_status) return complaint.request_status
  if (complaint.converted_work_order_id) return "converted"
  if (complaint.status === "approved") return "approved"
  if (complaint.status === "rejected") return "rejected"
  return "new"
}
