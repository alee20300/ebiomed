import { describe, it, expect } from "vitest"
import { referenceStandardSchema, calibrationBatchSchema } from "@/lib/schemas/calibration"

describe("referenceStandardSchema", () => {
  const validData = {
    serial_number: "CAL-2024-001",
    name: "Digital Multimeter Fluke 87V",
    certificate_expiry: "2025-06-15",
    calibration_interval_days: "365",
    reason: "Adding new reference standard for calibration lab",
  }

  it("validates with required fields", () => {
    const result = referenceStandardSchema.safeParse(validData)
    expect(result.success).toBe(true)
  })

  it("defaults calibration_interval_days to 365", () => {
    const result = referenceStandardSchema.safeParse({
      ...validData,
      calibration_interval_days: undefined,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.calibration_interval_days).toBe(365)
    }
  })

  it("rejects empty serial_number", () => {
    const result = referenceStandardSchema.safeParse({ ...validData, serial_number: "" })
    expect(result.success).toBe(false)
  })

  it("rejects empty name", () => {
    const result = referenceStandardSchema.safeParse({ ...validData, name: "" })
    expect(result.success).toBe(false)
  })

  it("requires certificate_expiry", () => {
    const { certificate_expiry: _, ...withoutExpiry } = validData
    const result = referenceStandardSchema.safeParse(withoutExpiry)
    expect(result.success).toBe(false)
  })

  it("requires reason", () => {
    const { reason: _, ...withoutReason } = validData
    const result = referenceStandardSchema.safeParse(withoutReason)
    expect(result.success).toBe(false)
  })
})

describe("calibrationBatchSchema", () => {
  const validData = {
    equipment_id: "550e8400-e29b-41d4-a716-446655440000",
    reference_standard_id: "660e8400-e29b-41d4-a716-446655440001",
    readings: [
      {
        parameter: "Temperature",
        measured_value: "37.0",
        expected_value: "37.0",
        tolerance_min: "36.5",
        tolerance_max: "37.5",
        unit: "°C",
      },
      {
        parameter: "Pressure",
        measured_value: "760",
        expected_value: "760",
        tolerance_min: "755",
        tolerance_max: "765",
        unit: "mmHg",
      },
    ],
    temperature_celsius: "22.5",
    humidity_percent: "45",
    reason: "Quarterly calibration of patient monitor per ISO 15189 requirements",
  }

  it("validates with full batch data", () => {
    const result = calibrationBatchSchema.safeParse(validData)
    expect(result.success).toBe(true)
  })

  it("validates with minimum fields (no env data)", () => {
    const { temperature_celsius, humidity_percent, ...minData } = validData
    const result = calibrationBatchSchema.safeParse(minData)
    expect(result.success).toBe(true)
  })

  it("rejects empty readings array", () => {
    const result = calibrationBatchSchema.safeParse({ ...validData, readings: [] })
    expect(result.success).toBe(false)
  })

  it("requires reference_standard_id", () => {
    const result = calibrationBatchSchema.safeParse({ ...validData, reference_standard_id: "" })
    expect(result.success).toBe(false)
  })

  it("requires reason", () => {
    const result = calibrationBatchSchema.safeParse({ ...validData, reason: "" })
    expect(result.success).toBe(false)
  })
})
