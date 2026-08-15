"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/lib/actions/profiles"
import { logAudit } from "@/lib/actions/audit"
import { requirePermission } from "@/lib/actions/permissions"
import { complaintReviewSchema, requestTriageSchema } from "@/lib/schemas/complaint"
import { getViewerDepartments } from "@/lib/actions/departments"
import type { Complaint, RequestNotification } from "@/lib/types"
import { calculateRequestTriage, requestWorkflowStatus } from "@/lib/utils/request-triage"

type SupabaseLike = Awaited<ReturnType<typeof createClient>>

async function createRequestNotification(
  supabase: SupabaseLike,
  complaint: Pick<Complaint, "id" | "reference_number" | "requester_email">,
  event: RequestNotification["event"],
  message: string,
  createdBy?: string | null
) {
  await supabase
    .schema("ebiomed")
    .from("request_notifications")
    .insert({
      complaint_id: complaint.id,
      reference_number: complaint.reference_number,
      recipient_email: complaint.requester_email,
      event,
      message,
      created_by: createdBy || null,
    })
}

export async function getComplaints(): Promise<Complaint[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .schema("ebiomed")
    .from("complaints")
    .select("*, equipment(*), converted_work_order:converted_work_order_id(*)")
    .eq("status", "pending_review")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  return (data || []) as unknown as Complaint[]
}

export async function getRequestDashboard(): Promise<Complaint[]> {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) return []

  let query = supabase
    .schema("ebiomed")
    .from("complaints")
    .select("*, equipment(*), converted_work_order:converted_work_order_id(*)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  if (user.role === "viewer") {
    const departments = await getViewerDepartments(user.id)
    const departmentNames = new Set(departments.map((department) => department.name))
    if (user.department) departmentNames.add(user.department)
    if (departmentNames.size === 0) return []
    query = query.in("reported_by_department", Array.from(departmentNames))
  }

  const { data } = await query
  return (data || []) as unknown as Complaint[]
}

export async function getComplaintById(id: string): Promise<Complaint | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .schema("ebiomed")
    .from("complaints")
    .select("*, equipment(*), reviewer:reviewer_id(*), converted_work_order:converted_work_order_id(*), notifications:request_notifications(*)")
    .eq("id", id)
    .single()

  if (!data) return null
  return data as unknown as Complaint
}

export async function getDuplicateRequestCandidates(id: string): Promise<Complaint[]> {
  const supabase = await createClient()
  const { data: complaint } = await supabase
    .schema("ebiomed")
    .from("complaints")
    .select("id, equipment_id, created_at")
    .eq("id", id)
    .single()

  if (!complaint?.equipment_id) return []

  const createdAt = new Date(complaint.created_at)
  const windowStart = new Date(createdAt.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString()

  const { data } = await supabase
    .schema("ebiomed")
    .from("complaints")
    .select("*, equipment(*)")
    .eq("equipment_id", complaint.equipment_id)
    .neq("id", id)
    .is("deleted_at", null)
    .is("converted_work_order_id", null)
    .gte("created_at", windowStart)
    .in("status", ["pending_review", "approved"])
    .order("created_at", { ascending: false })
    .limit(5)

  return (data || []) as unknown as Complaint[]
}

export async function getPublicRequestByReference(reference: string): Promise<Complaint | null> {
  const supabase = await createClient()
  const normalizedReference = reference.trim().toUpperCase()
  const { data } = await supabase.rpc("get_public_request_status", { p_reference: normalizedReference })

  if (!data) return null
  return data as Complaint
}

export async function triageComplaint(id: string, formData: FormData) {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) return redirect("/login")
  await requirePermission({ action: "triage", resource: "requests" }, `/complaints/${id}`)

  const raw = Object.fromEntries(formData)
  const parsed = requestTriageSchema.safeParse(raw)
  if (!parsed.success) {
    const messages = parsed.error.issues.map((e) => e.message).join(", ")
    throw new Error(messages)
  }

  const { data: complaint } = await supabase
    .schema("ebiomed")
    .from("complaints")
    .select("*, equipment(asset_criticality)")
    .eq("id", id)
    .single()

  if (!complaint) throw new Error("Complaint not found")
  if (complaint.status !== "pending_review") throw new Error("Only pending requests can be triaged")
  if (complaint.converted_work_order_id) throw new Error("Converted requests cannot be triaged")
  if (parsed.data.duplicate_of === id) throw new Error("A request cannot be marked as a duplicate of itself")

  const decision = calculateRequestTriage({
    urgency: parsed.data.urgency,
    patientSafetyRisk: parsed.data.patient_safety_risk,
    clinicalImpact: parsed.data.clinical_impact,
    patientCareCritical: parsed.data.patient_care_critical,
    assetCriticality: complaint.equipment?.asset_criticality,
    submittedAt: new Date(complaint.created_at),
  })

  await supabase
    .schema("ebiomed")
    .from("complaints")
    .update({
      request_status: "triaged",
      clinical_impact: parsed.data.clinical_impact,
      patient_safety_risk: parsed.data.patient_safety_risk,
      urgency: parsed.data.urgency,
      patient_care_critical: parsed.data.patient_care_critical,
      duplicate_of: parsed.data.duplicate_of,
      triage_notes: parsed.data.triage_notes,
      triaged_by: user.id,
      triaged_at: new Date().toISOString(),
      sla_response_due_at: decision.responseDueAt.toISOString(),
      sla_resolution_due_at: decision.resolutionDueAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)

  await logAudit("complaints", id, "update", [
    { field: "request_status", oldValue: requestWorkflowStatus(complaint as Complaint), newValue: "triaged" },
    { field: "urgency", oldValue: complaint.urgency || "normal", newValue: parsed.data.urgency },
    { field: "patient_safety_risk", oldValue: complaint.patient_safety_risk || "none", newValue: parsed.data.patient_safety_risk },
  ], parsed.data.triage_notes)

  await createRequestNotification(
    supabase,
    complaint as Complaint,
    "triaged",
    `Request triaged as ${parsed.data.urgency} urgency with ${parsed.data.patient_safety_risk} safety risk.`,
    user.id
  )

  revalidatePath("/complaints")
  revalidatePath(`/complaints/${id}`)
  revalidatePath("/dashboard")
  revalidatePath("/requests")
  redirect(`/complaints/${id}`)
}

export async function approveComplaint(id: string, formData?: FormData) {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) return redirect("/login")
  await requirePermission({ action: "approve", resource: "requests" }, `/complaints/${id}`)

  const reviewNotes = formData?.get("review_notes")?.toString().trim()

  const { data: complaint } = await supabase
    .schema("ebiomed")
    .from("complaints")
    .select("*")
    .eq("id", id)
    .single()

  if (!complaint) throw new Error("Complaint not found")
  if (complaint.status !== "pending_review") throw new Error("Complaint already reviewed")
  if (requestWorkflowStatus(complaint as Complaint) !== "triaged") {
    throw new Error("Request must be triaged before approval")
  }

  await supabase
    .schema("ebiomed")
    .from("complaints")
    .update({
      status: "approved",
      request_status: "approved",
      reviewer_id: user.id,
      review_notes: reviewNotes || null,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)

  await logAudit("complaints", id, "update", [
    { field: "status", oldValue: "pending_review", newValue: "approved" },
  ], reviewNotes || "Complaint approved")

  await createRequestNotification(
    supabase,
    complaint as Complaint,
    "approved",
    "Request approved by biomedical review. It is ready to convert to a corrective work order.",
    user.id
  )

  revalidatePath("/complaints")
  revalidatePath(`/complaints/${id}`)
  revalidatePath("/dashboard")
  revalidatePath("/requests")
  redirect(`/complaints/${id}`)
}

export async function convertComplaintToWorkOrder(id: string) {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) return redirect("/login")
  await requirePermission({ action: "convert", resource: "requests" }, `/complaints/${id}`)

  const { data: complaint } = await supabase
    .schema("ebiomed")
    .from("complaints")
    .select("*, equipment(asset_criticality)")
    .eq("id", id)
    .single()

  if (!complaint) throw new Error("Complaint not found")
  if (complaint.status !== "approved") throw new Error("Complaint must be approved before conversion")
  if (requestWorkflowStatus(complaint as Complaint) !== "approved") {
    throw new Error("Request must complete triage and approval before conversion")
  }
  if (complaint.converted_work_order_id) return redirect(`/work-orders/${complaint.converted_work_order_id}`)

  const decision = calculateRequestTriage({
    urgency: complaint.urgency || "normal",
    patientSafetyRisk: complaint.patient_safety_risk || "none",
    clinicalImpact: complaint.clinical_impact || "routine",
    patientCareCritical: complaint.patient_care_critical || false,
    assetCriticality: complaint.equipment?.asset_criticality,
    submittedAt: new Date(complaint.created_at),
  })

  const { data: wo, error: woError } = await supabase
    .schema("ebiomed")
    .from("work_orders")
    .insert({
      equipment_id: complaint.equipment_id,
      type: "corrective",
      priority: decision.workOrderPriority,
      status: "open",
      description: complaint.description,
      complaint_id: id,
      created_by: user.id,
      reported_by_name: complaint.reported_by_name,
      reported_by_department: complaint.reported_by_department,
      issue_photo_url: complaint.photo_url,
    })
    .select("id, equipment_id")
    .single()

  if (woError || !wo) throw new Error(woError?.message || "Failed to create work order")

  await logAudit("work_orders", wo.id, "insert", [
    { newValue: JSON.stringify({ equipment_id: complaint.equipment_id, description: complaint.description, complaint_id: id }) }
  ], "Created from complaint approval")

  await supabase
    .schema("ebiomed")
    .from("complaints")
    .update({
      request_status: "converted",
      converted_at: new Date().toISOString(),
      converted_work_order_id: wo.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)

  await logAudit("complaints", id, "update", [
    { field: "converted_work_order_id", oldValue: null, newValue: wo.id },
  ], "Converted approved complaint to work order")

  const { data: equip } = await supabase
    .schema("ebiomed")
    .from("equipment")
    .select("status")
    .eq("id", complaint.equipment_id)
    .single()

  await supabase
    .schema("ebiomed")
    .from("equipment")
    .update({ status: "under_repair", updated_at: new Date().toISOString() })
    .eq("id", complaint.equipment_id)

  await logAudit("equipment", complaint.equipment_id, "update", [
    { field: "status", oldValue: equip?.status || "unknown", newValue: "under_repair" }
  ], "Complaint converted to work order - equipment set to under repair")

  await createRequestNotification(
    supabase,
    complaint as Complaint,
    "converted",
    `Request converted to corrective work order ${wo.id.slice(0, 8)}.`,
    user.id
  )

  revalidatePath("/complaints")
  revalidatePath(`/complaints/${id}`)
  revalidatePath("/dashboard")
  revalidatePath("/requests")
  revalidatePath("/work-orders")
  redirect(`/work-orders/${wo.id}`)
}

export async function rejectComplaint(id: string, formData: FormData) {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) return redirect("/login")
  await requirePermission({ action: "reject", resource: "requests" }, `/complaints/${id}`)

  const raw = Object.fromEntries(formData)
  const parsed = complaintReviewSchema.safeParse(raw)
  if (!parsed.success) {
    const messages = parsed.error.issues.map((e) => e.message).join(", ")
    throw new Error(messages)
  }

  const { data: complaint } = await supabase
    .schema("ebiomed")
    .from("complaints")
    .select("*")
    .eq("id", id)
    .single()

  if (!complaint) throw new Error("Complaint not found")
  if (complaint.status !== "pending_review") throw new Error("Complaint already reviewed")

  await supabase
    .schema("ebiomed")
    .from("complaints")
    .update({
      status: "rejected",
      request_status: "rejected",
      reviewer_id: user.id,
      review_notes: parsed.data.review_notes,
      rejected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)

  await logAudit("complaints", id, "update", [
    { field: "status", oldValue: "pending_review", newValue: "rejected" },
  ], parsed.data.review_notes)

  await createRequestNotification(
    supabase,
    complaint as Complaint,
    "rejected",
    `Request rejected: ${parsed.data.review_notes}`,
    user.id
  )

  revalidatePath("/complaints")
  revalidatePath(`/complaints/${id}`)
  revalidatePath("/dashboard")
  revalidatePath("/requests")
  redirect(`/complaints/${id}`)
}
