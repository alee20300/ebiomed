"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/lib/actions/profiles"
import { getAppSetting } from "@/lib/actions/settings"
import { logAudit } from "@/lib/actions/audit"
import { logVisitSchema } from "@/lib/schemas/visit-log"
import type { VisitLog } from "@/lib/types"

export async function logEngineerVisit(formData: FormData) {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) throw new Error("You must be logged in")
  if (user.role !== "admin" && user.role !== "technician") {
    throw new Error("Only admins and technicians can log visits")
  }

  const enabled = await getAppSetting("call_log_workflow_enabled")
  if (enabled !== true) throw new Error("Call log workflow is disabled")

  const raw = Object.fromEntries(formData)
  const parsed = logVisitSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(", "))
  }

  const { data: complaint } = await supabase
    .schema("ebiomed")
    .from("complaints")
    .select("id, status")
    .eq("id", parsed.data.complaint_id)
    .single()

  if (!complaint) throw new Error("Complaint not found")
  if (complaint.status === "rejected") throw new Error("Cannot log visit for a rejected complaint")

  const { data: visit, error } = await supabase
    .schema("ebiomed")
    .from("visit_logs")
    .insert({
      complaint_id: parsed.data.complaint_id,
      visited_by: user.id,
    })
    .select("id, visited_at")
    .single()

  if (error || !visit) throw new Error(error?.message || "Failed to log visit")

  await logAudit("visit_logs", visit.id, "insert", [
    { newValue: JSON.stringify({ complaint_id: parsed.data.complaint_id, visited_by: user.id, visited_at: visit.visited_at }) }
  ], `Engineer visit logged for complaint ${parsed.data.complaint_id}`)

  revalidatePath("/report")
  revalidatePath("/complaints")
  return { success: true, visitedAt: visit.visited_at }
}

export async function getComplaintVisits(complaintId: string): Promise<VisitLog[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .schema("ebiomed")
    .from("visit_logs")
    .select("*, visited_profile:visited_by(id, full_name, role)")
    .eq("complaint_id", complaintId)
    .order("visited_at", { ascending: false })

  return (data || []) as unknown as VisitLog[]
}

export async function getOpenComplaintsForEquipment(equipmentId: string): Promise<{ id: string; created_at: string; description: string }[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .schema("ebiomed")
    .from("complaints")
    .select("id, created_at, description")
    .eq("equipment_id", equipmentId)
    .in("status", ["pending_review", "approved"])
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  return (data || []) as { id: string; created_at: string; description: string }[]
}
