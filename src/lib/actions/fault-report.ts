"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { logAudit } from "@/lib/actions/audit"
import { getAppSetting } from "@/lib/actions/settings"
import { getCurrentUser } from "@/lib/actions/profiles"
import { faultReportSchema, faultReportWithCallLogSchema, type FaultReportWithCallLogFormData } from "@/lib/schemas/fault-report"
import { clinicalImpacts, patientSafetyRisks, requestUrgencies } from "@/lib/utils/request-triage"
import { z } from "zod"

function generateReferenceNumber() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "")
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase()
  return `REQ-${date}-${suffix}`
}

const authenticatedRequestSchema = faultReportSchema.extend({
  urgency: z.enum(requestUrgencies).default("normal"),
  patient_safety_risk: z.enum(patientSafetyRisks).default("none"),
  clinical_impact: z.enum(clinicalImpacts).default("routine"),
  patient_care_critical: z.preprocess((value) => value === "on" || value === "true" || value === true, z.boolean()).default(false),
  reason: z.string().min(5, "Reason for change is required").max(500, "Reason too long").default("Fault request created from app"),
})

export async function submitFaultReport(formData: FormData) {
  const supabase = await createClient()
  const raw = Object.fromEntries(formData)
  const user = await getCurrentUser()
  if (!user) {
    const tag = encodeURIComponent(String(raw.equipment_tag || ""))
    const next = encodeURIComponent(`/report?tag=${tag}&action=fault`)
    return redirect(`/login?next=${next}`)
  }

  const callLogEnabled = await getAppSetting("call_log_workflow_enabled")

  const schema = callLogEnabled === true ? faultReportWithCallLogSchema : faultReportSchema
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    const messages = parsed.error.issues.map((e) => e.message).join(", ")
    return redirect(`/report?tag=${raw.equipment_tag || ""}&error=${encodeURIComponent(messages)}`)
  }

  const photo = formData.get("photo") as File | null
  if (!photo || photo.size === 0) {
    return redirect(`/report?tag=${raw.equipment_tag || ""}&error=${encodeURIComponent("Photo is required")}`)
  }

  const referenceNumber = generateReferenceNumber()
  const submittedAt = new Date()
  const slaDueAt = new Date(submittedAt.getTime() + 24 * 60 * 60 * 1000)

  const complaintData: Record<string, string | boolean | null> = {
    equipment_id: parsed.data.equipment_id,
    description: parsed.data.description,
    reported_by_name: parsed.data.reported_by_name || null,
    reported_by_department: parsed.data.reported_by_department || null,
    requester_email: parsed.data.requester_email || null,
    reference_number: referenceNumber,
    sla_due_at: slaDueAt.toISOString(),
    status: "pending_review",
  }

  if (callLogEnabled === true && "call_status" in parsed.data) {
    const callData = parsed.data as FaultReportWithCallLogFormData
    complaintData.called_department = callData.called_department
    complaintData.answered_by = callData.answered_by || null
    complaintData.call_status = callData.call_status
  }

  const { data: complaint, error: complaintError } = await supabase
    .schema("ebiomed")
    .from("complaints")
    .insert(complaintData)
    .select("id, equipment_id, reference_number, requester_email")
    .single()

  if (complaintError || !complaint) {
    return redirect(`/report?tag=${raw.equipment_tag || ""}&error=${encodeURIComponent(complaintError?.message || "Failed to submit complaint")}`)
  }

  const ext = photo.name.split(".").pop() || "jpg"
  const photoPath = `${complaint.id}.${ext}`
  const { error: uploadError } = await supabase.storage
    .from("fault-photos")
    .upload(photoPath, photo, { contentType: photo.type, upsert: true })

  if (uploadError) {
    return redirect(`/report?tag=${raw.equipment_tag || ""}&error=${encodeURIComponent(uploadError.message)}`)
  }

  const { data: urlData } = supabase.storage.from("fault-photos").getPublicUrl(photoPath)

  await supabase
    .schema("ebiomed")
    .from("complaints")
    .update({ photo_url: urlData.publicUrl })
    .eq("id", complaint.id)

  await supabase
    .schema("ebiomed")
    .from("request_notifications")
    .insert({
      complaint_id: complaint.id,
      reference_number: complaint.reference_number,
      recipient_email: complaint.requester_email,
      event: "submitted",
      message: "Request submitted and queued for biomedical review.",
    })

  const reason = "Fault reported by " + (parsed.data.reported_by_name || "staff")
  await logAudit("complaints", complaint.id, "insert", [
    { newValue: JSON.stringify({ equipment_id: parsed.data.equipment_id, description: parsed.data.description, reported_by_name: parsed.data.reported_by_name, reported_by_department: parsed.data.reported_by_department, photo_url: urlData.publicUrl, called_engineer: complaintData.answered_by, call_status: complaintData.call_status }) }
  ], reason)

  revalidatePath("/dashboard")
  revalidatePath("/complaints")
  revalidatePath("/requests")
  redirect(`/report/success?ref=${complaint.reference_number}`)
}

export async function createAuthenticatedRequest(formData: FormData) {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) return redirect("/login")

  const raw = Object.fromEntries(formData)
  const parsed = authenticatedRequestSchema.safeParse(raw)
  if (!parsed.success) {
    const messages = parsed.error.issues.map((e) => e.message).join(", ")
    return redirect(`/requests/new?error=${encodeURIComponent(messages)}`)
  }

  const referenceNumber = generateReferenceNumber()
  const submittedAt = new Date()
  const slaDueAt = new Date(submittedAt.getTime() + 24 * 60 * 60 * 1000)

  const { data: complaint, error: complaintError } = await supabase
    .schema("ebiomed")
    .from("complaints")
    .insert({
      equipment_id: parsed.data.equipment_id,
      description: parsed.data.description,
      reported_by_name: parsed.data.reported_by_name || user.full_name || null,
      reported_by_department: parsed.data.reported_by_department || user.department || null,
      requester_email: parsed.data.requester_email || user.email || null,
      reference_number: referenceNumber,
      sla_due_at: slaDueAt.toISOString(),
      status: "pending_review",
      request_status: "new",
      urgency: parsed.data.urgency,
      patient_safety_risk: parsed.data.patient_safety_risk,
      clinical_impact: parsed.data.clinical_impact,
      patient_care_critical: parsed.data.patient_care_critical,
    })
    .select("id, equipment_id, reference_number, requester_email")
    .single()

  if (complaintError || !complaint) {
    return redirect(`/requests/new?error=${encodeURIComponent(complaintError?.message || "Failed to create request")}`)
  }

  const photo = formData.get("photo") as File | null
  let photoUrl: string | null = null
  if (photo && photo.size > 0) {
    const ext = photo.name.split(".").pop() || "jpg"
    const photoPath = `${complaint.id}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from("fault-photos")
      .upload(photoPath, photo, { contentType: photo.type, upsert: true })

    if (uploadError) {
      return redirect(`/requests/new?error=${encodeURIComponent(uploadError.message)}`)
    }

    const { data: urlData } = supabase.storage.from("fault-photos").getPublicUrl(photoPath)
    photoUrl = urlData.publicUrl
    await supabase
      .schema("ebiomed")
      .from("complaints")
      .update({ photo_url: photoUrl })
      .eq("id", complaint.id)
  }

  await supabase
    .schema("ebiomed")
    .from("request_notifications")
    .insert({
      complaint_id: complaint.id,
      reference_number: complaint.reference_number,
      recipient_email: complaint.requester_email,
      event: "submitted",
      message: "Request submitted from app and queued for biomedical review.",
      created_by: user.id,
    })

  await logAudit("complaints", complaint.id, "insert", [
    { newValue: JSON.stringify({ equipment_id: parsed.data.equipment_id, description: parsed.data.description, reported_by_name: parsed.data.reported_by_name || user.full_name, reported_by_department: parsed.data.reported_by_department || user.department, photo_url: photoUrl }) }
  ], parsed.data.reason)

  revalidatePath("/dashboard")
  revalidatePath("/complaints")
  revalidatePath("/requests")
  redirect(`/requests?created=${complaint.reference_number}`)
}
