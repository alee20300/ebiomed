"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/lib/actions/profiles"
import { logAudit } from "@/lib/actions/audit"
import { complaintReviewSchema } from "@/lib/schemas/complaint"
import type { Complaint } from "@/lib/types"

export async function getComplaints(): Promise<Complaint[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .schema("ebiomed")
    .from("complaints")
    .select("*, equipment(*)")
    .eq("status", "pending_review")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  return (data || []) as unknown as Complaint[]
}

export async function getComplaintById(id: string): Promise<Complaint | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .schema("ebiomed")
    .from("complaints")
    .select("*, equipment(*), reviewer:reviewer_id(*)")
    .eq("id", id)
    .single()

  if (!data) return null
  return data as unknown as Complaint
}

export async function approveComplaint(id: string, reviewNotes?: string) {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) return redirect("/login")

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
      status: "approved",
      reviewer_id: user.id,
      review_notes: reviewNotes || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)

  await logAudit("complaints", id, "update", [
    { field: "status", oldValue: "pending_review", newValue: "approved" },
  ], reviewNotes || "Complaint approved")

  const { data: wo, error: woError } = await supabase
    .schema("ebiomed")
    .from("work_orders")
    .insert({
      equipment_id: complaint.equipment_id,
      type: "corrective",
      priority: "medium",
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
  ], "Complaint approved — equipment set to under repair")

  revalidatePath("/complaints")
  revalidatePath("/dashboard")
  revalidatePath("/work-orders")
  redirect(`/work-orders/${wo.id}`)
}

export async function rejectComplaint(id: string, formData: FormData) {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) return redirect("/login")

  const raw = Object.fromEntries(formData)
  const parsed = complaintReviewSchema.safeParse(raw)
  if (!parsed.success) {
    const messages = parsed.error.errors.map((e) => e.message).join(", ")
    throw new Error(messages)
  }

  const { data: complaint } = await supabase
    .schema("ebiomed")
    .from("complaints")
    .select("status")
    .eq("id", id)
    .single()

  if (!complaint) throw new Error("Complaint not found")
  if (complaint.status !== "pending_review") throw new Error("Complaint already reviewed")

  await supabase
    .schema("ebiomed")
    .from("complaints")
    .update({
      status: "rejected",
      reviewer_id: user.id,
      review_notes: parsed.data.review_notes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)

  await logAudit("complaints", id, "update", [
    { field: "status", oldValue: "pending_review", newValue: "rejected" },
  ], parsed.data.review_notes)

  revalidatePath("/complaints")
  revalidatePath("/dashboard")
  redirect("/complaints")
}
