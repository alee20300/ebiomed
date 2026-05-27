"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/lib/actions/profiles"
import { logAudit } from "@/lib/actions/audit"
import { recordSignature } from "@/lib/actions/signatures"
import { referenceStandardSchema, calibrationBatchSchema } from "@/lib/schemas/calibration"
import type { ReferenceStandard, CalibrationReading } from "@/lib/types"

// ============================================================
// Reference Standards
// ============================================================

export async function getReferenceStandards(): Promise<ReferenceStandard[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("reference_standards")
    .select("*")
    .is("deleted_at", null)
    .order("name")

  return (data || []) as ReferenceStandard[]
}

export async function getReferenceStandardById(id: string): Promise<ReferenceStandard | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("reference_standards")
    .select("*")
    .eq("id", id)
    .single()

  return data as ReferenceStandard | null
}

export async function createReferenceStandard(formData: FormData) {
  const supabase = await createClient()
  const raw = Object.fromEntries(formData)
  const parsed = referenceStandardSchema.safeParse(raw)

  if (!parsed.success) {
    const msg = parsed.error.errors.map((e) => e.message).join(", ")
    return redirect(`/reference-standards?error=${encodeURIComponent(msg)}`)
  }

  const { data, error } = await supabase
    .from("reference_standards")
    .insert({
      serial_number: parsed.data.serial_number,
      name: parsed.data.name,
      manufacturer: parsed.data.manufacturer || null,
      model: parsed.data.model || null,
      certificate_number: parsed.data.certificate_number || null,
      certificate_expiry: parsed.data.certificate_expiry,
      calibration_interval_days: parsed.data.calibration_interval_days,
      location: parsed.data.location || null,
      notes: parsed.data.notes || null,
    })
    .select("id")
    .single()

  if (error) {
    return redirect(`/reference-standards?error=${encodeURIComponent(error.message)}`)
  }

  await logAudit("reference_standards", data.id, "insert", [
    { newValue: JSON.stringify(parsed.data) }
  ], parsed.data.reason)

  revalidatePath("/reference-standards")
  redirect("/reference-standards")
}

export async function updateReferenceStandard(id: string, formData: FormData) {
  const supabase = await createClient()
  const raw = Object.fromEntries(formData)
  const parsed = referenceStandardSchema.safeParse(raw)

  if (!parsed.success) {
    const msg = parsed.error.errors.map((e) => e.message).join(", ")
    return redirect(`/reference-standards?error=${encodeURIComponent(msg)}`)
  }

  const { error } = await supabase
    .from("reference_standards")
    .update({
      serial_number: parsed.data.serial_number,
      name: parsed.data.name,
      manufacturer: parsed.data.manufacturer || null,
      model: parsed.data.model || null,
      certificate_number: parsed.data.certificate_number || null,
      certificate_expiry: parsed.data.certificate_expiry,
      calibration_interval_days: parsed.data.calibration_interval_days,
      location: parsed.data.location || null,
      notes: parsed.data.notes || null,
    })
    .eq("id", id)

  if (error) {
    return redirect(`/reference-standards?error=${encodeURIComponent(error.message)}`)
  }

  await logAudit("reference_standards", id, "update", [
    { newValue: JSON.stringify(parsed.data) }
  ], parsed.data.reason)

  revalidatePath("/reference-standards")
  redirect("/reference-standards")
}

export async function deleteReferenceStandard(id: string, reason: string) {
  const supabase = await createClient()
  await supabase.from("reference_standards").update({ deleted_at: new Date().toISOString() }).eq("id", id)

  await logAudit("reference_standards", id, "delete", [], reason || "Deleted")

  revalidatePath("/reference-standards")
}

// ============================================================
// Calibration Readings
// ============================================================

export async function getCalibrationReadings(equipmentId: string): Promise<CalibrationReading[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("calibration_readings")
    .select("*, reference_standard:reference_standard_id(*), profile:recorded_by(full_name, role)")
    .eq("equipment_id", equipmentId)
    .order("recorded_at", { ascending: false })

  return (data || []) as unknown as CalibrationReading[]
}

export async function submitCalibrationBatch(formData: FormData) {
  const supabase = await createClient()
  const raw = Object.fromEntries(formData)

  // Parse readings array from form
  const readingsRaw = formData.get("readings") as string
  let readings: Array<{
    parameter: string; measured_value: string; expected_value: string;
    tolerance_min: string; tolerance_max: string; unit?: string; notes?: string
  }> = []

  try {
    readings = JSON.parse(readingsRaw || "[]")
  } catch {
    return redirect(`/equipment/${raw.equipment_id}?error=${encodeURIComponent("Invalid readings data")}`)
  }

  const parsed = calibrationBatchSchema.safeParse({
    ...raw,
    readings,
    temperature_celsius: raw.temperature_celsius || undefined,
    humidity_percent: raw.humidity_percent || undefined,
  })

  if (!parsed.success) {
    const msg = parsed.error.errors.map((e) => e.message).join(", ")
    return redirect(`/equipment/${raw.equipment_id}?error=${encodeURIComponent(msg)}`)
  }

  const user = await getCurrentUser()
  if (!user) return redirect(`/equipment/${parsed.data.equipment_id}?error=${encodeURIComponent("Not authenticated")}`)

  // Validate reference standard is not expired
  const { data: refStd } = await supabase
    .from("reference_standards")
    .select("status, certificate_expiry")
    .eq("id", parsed.data.reference_standard_id)
    .single()

  if (!refStd) {
    return redirect(`/equipment/${parsed.data.equipment_id}?error=${encodeURIComponent("Reference standard not found")}`)
  }

  if (refStd.status === "expired" || new Date(refStd.certificate_expiry) < new Date()) {
    return redirect(`/equipment/${parsed.data.equipment_id}?error=${encodeURIComponent("Reference standard certificate has expired. Calibration cannot proceed.")}`)
  }

  // Evaluate each reading against tolerance
  let hasFailedReadings = false
  const readingRecords = parsed.data.readings.map((r: typeof parsed.data.readings[number]) => {
    const passed = r.measured_value >= r.tolerance_min && r.measured_value <= r.tolerance_max
    if (!passed) hasFailedReadings = true
    return {
      equipment_id: parsed.data.equipment_id,
      reference_standard_id: parsed.data.reference_standard_id,
      parameter: r.parameter,
      measured_value: r.measured_value,
      expected_value: r.expected_value,
      tolerance_min: r.tolerance_min,
      tolerance_max: r.tolerance_max,
      unit: r.unit || null,
      passed,
      notes: r.notes || null,
      recorded_by: user.id,
    }
  })

  // Insert readings
  const { data: insertedReadings, error } = await supabase
    .from("calibration_readings")
    .insert(readingRecords)
    .select("id")

  if (error) {
    return redirect(`/equipment/${parsed.data.equipment_id}?error=${encodeURIComponent(error.message)}`)
  }

  // Log environmental reading if provided
  if (parsed.data.temperature_celsius !== undefined || parsed.data.humidity_percent !== undefined) {
    for (const reading of insertedReadings) {
      await supabase.from("environmental_readings").insert({
        equipment_id: parsed.data.equipment_id,
        calibration_reading_id: reading.id,
        temperature_celsius: parsed.data.temperature_celsius ?? null,
        humidity_percent: parsed.data.humidity_percent ?? null,
        recorded_by: user.id,
      })
    }
  }

  // Update equipment calibration dates
  const now = new Date().toISOString()
  const nextDue = new Date()
  nextDue.setDate(nextDue.getDate() + 365) // default: 1 year

  const newStatus = hasFailedReadings ? "out_of_tolerance" : "certified"

  await supabase
    .from("equipment")
    .update({
      last_calibrated: now,
      next_calibration_due: nextDue.toISOString(),
      status: newStatus,
    })
    .eq("id", parsed.data.equipment_id)

  // Audit trail
  await logAudit("calibration_readings", parsed.data.equipment_id, "insert", [
    { newValue: JSON.stringify({ readings_count: readingRecords.length, has_failed: hasFailedReadings }) }
  ], parsed.data.reason)

  await logAudit("equipment", parsed.data.equipment_id, "update", [
    { field: "status", newValue: newStatus },
    { field: "last_calibrated", newValue: now }
  ], parsed.data.reason)

  // Record signature
  await recordSignature("calibration", parsed.data.equipment_id, "Calibrated")

  revalidatePath("/equipment")
  revalidatePath(`/equipment/${parsed.data.equipment_id}`)
  revalidatePath("/dashboard")

  if (hasFailedReadings) {
    return redirect(`/equipment/${parsed.data.equipment_id}?warning=${encodeURIComponent("Calibration completed but some readings are out of tolerance. Equipment marked as Out of Tolerance.")}`)
  }

  redirect(`/equipment/${parsed.data.equipment_id}`)
}

export async function updateEquipmentCalibrationParams(equipmentId: string, formData: FormData) {
  const supabase = await createClient()
  const raw = Object.fromEntries(formData)

  const calibration_interval_days = parseInt(raw.calibration_interval_days as string) || 365
  let calibration_parameters = null
  try {
    const paramsRaw = raw.calibration_parameters as string
    if (paramsRaw) calibration_parameters = JSON.parse(paramsRaw)
  } catch { /* ignore parse errors */ }

  const { error } = await supabase
    .from("equipment")
    .update({
      calibration_interval_days,
      calibration_parameters,
    })
    .eq("id", equipmentId)

  if (error) {
    return redirect(`/equipment/${equipmentId}?error=${encodeURIComponent(error.message)}`)
  }

  await logAudit("equipment", equipmentId, "update", [
    { field: "calibration_interval_days", newValue: String(calibration_interval_days) }
  ], raw.reason as string || "Calibration parameters updated")

  revalidatePath(`/equipment/${equipmentId}`)
  redirect(`/equipment/${equipmentId}`)
}
