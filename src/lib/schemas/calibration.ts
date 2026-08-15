import { z } from "zod"

export const referenceStandardSchema = z.object({
  serial_number: z.string().min(1, "Serial number is required"),
  name: z.string().min(1, "Name is required"),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  certificate_number: z.string().optional(),
  certificate_expiry: z.string().min(1, "Certificate expiry date is required"),
  calibration_interval_days: z.coerce.number().int().min(1, "Must be at least 1 day").default(365),
  location: z.string().optional(),
  notes: z.string().optional(),
  reason: z.string().min(5, "Reason for change is required").max(500),
})

export const calibrationReadingSchema = z.object({
  equipment_id: z.string().uuid("Equipment is required"),
  reference_standard_id: z.string().uuid().optional(),
  parameter: z.string().min(1, "Parameter name is required"),
  measured_value: z.coerce.number(),
  expected_value: z.coerce.number(),
  tolerance_min: z.coerce.number(),
  tolerance_max: z.coerce.number(),
  unit: z.string().optional(),
  notes: z.string().optional(),
  work_order_id: z.string().uuid().optional(),
  reason: z.string().min(5, "Reason for change is required").max(500),
})

export const environmentalReadingSchema = z.object({
  equipment_id: z.string().uuid().optional(),
  calibration_reading_id: z.string().uuid().optional(),
  temperature_celsius: z.coerce.number().optional(),
  humidity_percent: z.coerce.number().optional(),
})

export const calibrationInvestigationSchema = z.object({
  reading_id: z.string().uuid("Calibration reading is required"),
  equipment_id: z.string().uuid("Equipment is required"),
  investigation_status: z.enum(["in_progress", "completed"]),
  investigation_notes: z.string().min(5, "Investigation notes are required").max(1000),
  corrective_action: z.string().max(1000).optional(),
  reason: z.string().min(5, "Reason for change is required").max(500),
}).refine(
  (data) => data.investigation_status !== "completed" || !!data.corrective_action?.trim(),
  {
    message: "Corrective action is required to complete investigation",
    path: ["corrective_action"],
  }
)

export const calibrationBatchSchema = z.object({
  equipment_id: z.string().uuid("Equipment is required"),
  reference_standard_id: z.string().uuid("Reference standard is required"),
  readings: z.array(z.object({
    parameter: z.string(),
    measured_value: z.coerce.number(),
    expected_value: z.coerce.number(),
    tolerance_min: z.coerce.number(),
    tolerance_max: z.coerce.number(),
    unit: z.string().optional(),
    notes: z.string().optional(),
  })).min(1, "At least one reading is required"),
  temperature_celsius: z.coerce.number().optional(),
  humidity_percent: z.coerce.number().optional(),
  reason: z.string().min(5, "Reason for change is required").max(500),
})

export type ReferenceStandardFormData = z.infer<typeof referenceStandardSchema>
export type CalibrationReadingFormData = z.infer<typeof calibrationReadingSchema>
export type CalibrationBatchFormData = z.infer<typeof calibrationBatchSchema>
export type CalibrationInvestigationFormData = z.infer<typeof calibrationInvestigationSchema>
