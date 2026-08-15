import { z } from "zod"
import { clinicalImpacts, patientSafetyRisks, requestUrgencies } from "@/lib/utils/request-triage"

export const complaintReviewSchema = z.object({
  review_notes: z.string().min(5, "Review notes must be at least 5 characters").max(500, "Review notes must be under 500 characters"),
})

const optionalUuid = z
  .string()
  .trim()
  .optional()
  .transform((value) => !value || value === "none" ? null : value)
  .pipe(z.uuid().nullable())

export const requestTriageSchema = z.object({
  urgency: z.enum(requestUrgencies),
  clinical_impact: z.enum(clinicalImpacts),
  patient_safety_risk: z.enum(patientSafetyRisks),
  patient_care_critical: z.preprocess((value) => value === "on" || value === "true" || value === true, z.boolean()),
  duplicate_of: optionalUuid,
  triage_notes: z.string().trim().min(5, "Triage notes must be at least 5 characters").max(1000, "Triage notes must be under 1000 characters"),
})
