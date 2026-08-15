"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/lib/actions/profiles"
import { getViewerDepartmentIds } from "@/lib/actions/departments"
import { logAudit } from "@/lib/actions/audit"
import { hasPermission, requirePermission } from "@/lib/actions/permissions"
import { recordSignature, verifyPassword } from "@/lib/actions/signatures"
import { workOrderSchema, workOrderUpdateSchema } from "@/lib/schemas/work-order"
import {
  getWorkOrderCloseoutRequirements,
  requiresWorkOrderReauth,
  validateWorkOrderCloseout,
  validateWorkOrderStatusTransition,
  type WorkOrderCloseoutRequirement,
  type WorkOrderStatus,
} from "@/lib/utils/work-order-lifecycle"
import { completePMOccurrenceForWorkOrder } from "@/lib/actions/pm-engine"
import type { WorkOrder } from "@/lib/types"
import type { WorkOrderStatusDraftPayload } from "@/lib/offline/work-order-drafts"

export async function createWorkOrder(formData: FormData) {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) return redirect("/login")
  await requirePermission({ action: "write", resource: "work_orders" }, "/work-orders/new")

  const raw = Object.fromEntries(formData)
  if (!raw.assigned_to) delete raw.assigned_to
  const parsed = workOrderSchema.safeParse(raw)

  if (!parsed.success) {
    const messages = parsed.error.issues.map((e) => e.message).join(", ")
    return redirect(`/work-orders/new?error=${encodeURIComponent(messages)}`)
  }

  // Validate equipment is not retired
  const { data: equip } = await supabase
    .from("equipment")
    .select("status, lifecycle_stage, decommissioning_status")
    .eq("id", parsed.data.equipment_id)
    .single()

  if (equip?.status === "retired" || equip?.lifecycle_stage === "retired" || equip?.decommissioning_status === "completed") {
    return redirect(`/work-orders/new?error=${encodeURIComponent("Cannot create work order for retired or decommissioned equipment")}`)
  }

  const { reason, ...workOrderData } = parsed.data
  const safetyEscalation = ["high", "critical"].includes(parsed.data.patient_safety_impact)

  const { data, error } = await supabase.from("work_orders").insert({
    ...workOrderData,
    assigned_to: parsed.data.assigned_to || null,
    created_by: user.id,
    safety_escalated_at: safetyEscalation ? new Date().toISOString() : null,
    safety_escalated_by: safetyEscalation ? user.id : null,
  }).select().single()

  if (error) {
    return redirect(`/work-orders/new?error=${encodeURIComponent(error.message)}`)
  }

  await logAudit("work_orders", data.id, "insert", [
    { newValue: JSON.stringify({ equipment_id: parsed.data.equipment_id, type: parsed.data.type, priority: parsed.data.priority, description: parsed.data.description, assigned_to: parsed.data.assigned_to, patient_safety_impact: parsed.data.patient_safety_impact }) }
  ], reason)

  revalidatePath("/work-orders")
  revalidatePath("/dashboard")
  redirect("/work-orders")
}

export async function getWorkOrders(): Promise<WorkOrder[]> {
  const supabase = await createClient()
  const user = await getCurrentUser()

  if (user?.role === "viewer") {
    const deptIds = await getViewerDepartmentIds(user.id)
    if (deptIds.length === 0) return []

    const { data: departments, error: deptError } = await supabase
      .from("departments")
      .select("name")
      .in("id", deptIds)

    if (deptError) return []
    const deptNames = (departments || []).map((d: { name: string }) => d.name)

    if (deptNames.length === 0) return []

    const { data: equipIds, error: equipError } = await supabase
      .from("equipment")
      .select("id")
      .in("department", deptNames)

    if (equipError || !equipIds) return []

    const equipmentIdList = equipIds.map((e: { id: string }) => e.id)

    if (equipmentIdList.length === 0) return []

    const { data, error: woError } = await supabase
      .from("work_orders")
      .select("*, equipment(*)")
      .in("equipment_id", equipmentIdList)
      .in("status", ["open", "in_progress", "on_hold"])
      .order("created_at", { ascending: false })

    if (woError || !data) return []
    return data as unknown as WorkOrder[]
  }

  const { data, error } = await supabase
    .from("work_orders")
    .select("*, equipment(*)")
    .order("created_at", { ascending: false })

  if (error) return []
  return data as unknown as WorkOrder[]
}

export async function getWorkOrderById(id: string): Promise<WorkOrder | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("work_orders")
    .select("*, equipment(*), assigned_profile:assigned_to(*), created_profile:created_by(*)")
    .eq("id", id)
    .single()

  if (error) return null
  return data as unknown as WorkOrder
}

async function getWorkOrderTimeEntryCount(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workOrderId: string
) {
  const { data: jobCards } = await supabase
    .schema("ebiomed")
    .from("job_cards")
    .select("id")
    .eq("work_order_id", workOrderId)

  const jobCardIds = (jobCards || []).map((jobCard) => jobCard.id)
  if (jobCardIds.length === 0) return 0

  const { count } = await supabase
    .schema("ebiomed")
    .from("job_card_entries")
    .select("id", { count: "exact", head: true })
    .in("job_card_id", jobCardIds)

  return count || 0
}

export async function getWorkOrderCloseoutStatus(workOrderId: string): Promise<{
  timeEntryCount: number
  requirements: WorkOrderCloseoutRequirement[]
}> {
  const supabase = await createClient()
  const [{ data: workOrder }, timeEntryCount] = await Promise.all([
    supabase
      .schema("ebiomed")
      .from("work_orders")
      .select("resolution_notes")
      .eq("id", workOrderId)
      .single(),
    getWorkOrderTimeEntryCount(supabase, workOrderId),
  ])

  return {
    timeEntryCount,
    requirements: getWorkOrderCloseoutRequirements({
      resolutionNotes: workOrder?.resolution_notes || null,
      timeEntryCount,
      signatureReason: null,
      reauthVerified: false,
    }),
  }
}

export async function updateWorkOrderStatus(id: string, formData: FormData) {
  const supabase = await createClient()
  await requirePermission({ action: "write", resource: "work_orders" }, `/work-orders/${id}`)
  const raw = Object.fromEntries(formData)

  if (!raw.assigned_to) delete raw.assigned_to

  // Fetch current status to enforce lifecycle rules
  const { data: current } = await supabase
    .from("work_orders")
    .select("status, started_at, resolution_notes, patient_safety_impact, safety_escalated_at")
    .eq("id", id)
    .single()

  if (!current) return redirect(`/work-orders/${id}?error=${encodeURIComponent("Work order not found")}`)

  const newStatus = raw.status as WorkOrderStatus | undefined

  const transition = validateWorkOrderStatusTransition(current.status as WorkOrderStatus, newStatus)
  if (!transition.valid) {
    return redirect(`/work-orders/${id}?error=${encodeURIComponent(transition.message)}`)
  }

  const parsed = workOrderUpdateSchema.safeParse(raw)
  if (!parsed.success) {
    const messages = parsed.error.issues.map((e) => e.message).join(", ")
    return redirect(`/work-orders/${id}?error=${encodeURIComponent(messages)}`)
  }

  if (parsed.data.status === "completed") {
    await requirePermission({ action: "close", resource: "work_orders" }, `/work-orders/${id}`)
  }
  if (parsed.data.status === "cancelled") {
    await requirePermission({ action: "cancel", resource: "work_orders" }, `/work-orders/${id}`)
  }

  let reauthVerified = false
  if (requiresWorkOrderReauth(parsed.data.status)) {
    const password = String(raw.reauth_password || "")
    reauthVerified = password.length > 0 && await verifyPassword(password)
    if (!reauthVerified) {
      return redirect(`/work-orders/${id}?error=${encodeURIComponent("Re-authentication is required to complete or cancel a work order")}`)
    }
  }

  const { reason, ...workOrderUpdateData } = parsed.data
  const updateData: Record<string, unknown> = { ...workOrderUpdateData }
  const safetyImpact = parsed.data.patient_safety_impact || current.patient_safety_impact
  if (["high", "critical"].includes(safetyImpact) && !current.safety_escalated_at) {
    const user = await getCurrentUser()
    updateData.safety_escalated_at = new Date().toISOString()
    updateData.safety_escalated_by = user?.id || null
  }

  if (parsed.data.status === "in_progress") {
    updateData.started_at = new Date().toISOString()
  }

  if (parsed.data.status === "completed") {
    const finalResolutionNotes = parsed.data.resolution_notes ?? current.resolution_notes
    const timeEntryCount = await getWorkOrderTimeEntryCount(supabase, id)
    const closeout = validateWorkOrderCloseout({
      resolutionNotes: finalResolutionNotes,
      timeEntryCount,
      signatureReason: reason,
      reauthVerified,
    })

    if (!closeout.valid) {
      return redirect(`/work-orders/${id}?error=${encodeURIComponent(closeout.messages.join(" "))}`)
    }

    updateData.resolution_notes = finalResolutionNotes?.trim()
    updateData.completed_at = new Date().toISOString()

    // Calculate downtime
    if (current.started_at) {
      const started = new Date(current.started_at).getTime()
      const completed = new Date(updateData.completed_at as string).getTime()
      const minutes = Math.round((completed - started) / 60000)
      updateData.downtime_minutes = minutes
    }
  }

  const { error } = await supabase
    .from("work_orders")
    .update(updateData)
    .eq("id", id)

  if (error) {
    return redirect(`/work-orders/${id}?error=${encodeURIComponent(error.message)}`)
  }

  const statusReason = reason || "Status change"
  await logAudit("work_orders", id, "update", [
    { field: "status", oldValue: current.status, newValue: newStatus }
  ], statusReason)

  // Record electronic signature for completed/cancelled
  if (parsed.data.status === "completed" || parsed.data.status === "cancelled") {
    await recordSignature(
      "work_order",
      id,
      parsed.data.status === "completed" ? "Verified" : "Reviewed",
      statusReason
    )
  }

  // If completed, update equipment status back to active
  if (parsed.data.status === "completed") {
    await completePMOccurrenceForWorkOrder(id, updateData.completed_at as string)

    const { data: wo } = await supabase
      .from("work_orders")
      .select("equipment_id")
      .eq("id", id)
      .single()

    if (wo) {
      const { data: equip } = await supabase
        .from("equipment")
        .select("status")
        .eq("id", wo.equipment_id)
        .single()

      await supabase
        .from("equipment")
        .update({ status: "active", updated_at: new Date().toISOString() })
        .eq("id", wo.equipment_id)

      await logAudit("equipment", wo.equipment_id, "update", [
        { field: "status", oldValue: equip?.status || "unknown", newValue: "active" }
      ], statusReason)
    }
  }

  // If started work, set equipment to under_repair
  if (parsed.data.status === "in_progress") {
    const { data: wo } = await supabase
      .from("work_orders")
      .select("equipment_id")
      .eq("id", id)
      .single()

    if (wo) {
      await supabase
        .from("equipment")
        .update({ status: "under_repair", updated_at: new Date().toISOString() })
        .eq("id", wo.equipment_id)

      await logAudit("equipment", wo.equipment_id, "update", [
        { field: "status", oldValue: "active", newValue: "under_repair" }
      ], statusReason)
    }
  }

  revalidatePath("/work-orders")
  revalidatePath(`/work-orders/${id}`)
  revalidatePath("/dashboard")
  redirect(`/work-orders/${id}`)
}

export async function syncOfflineWorkOrderStatusDraft(payload: WorkOrderStatusDraftPayload): Promise<{
  ok: boolean
  error?: string
}> {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: "Login is required before syncing this draft." }
  if (!(await hasPermission({ action: "write", resource: "work_orders" }))) {
    return { ok: false, error: "You do not have permission for that action." }
  }

  if (payload.status === "completed" || payload.status === "cancelled") {
    return {
      ok: false,
      error: "Completion and cancellation drafts require interactive re-authentication before sync.",
    }
  }

  const { data: current } = await supabase
    .schema("ebiomed")
    .from("work_orders")
    .select("status, assigned_to, equipment_id")
    .eq("id", payload.workOrderId)
    .single()

  if (!current) return { ok: false, error: "Work order no longer exists." }
  if (current.status === "completed" || current.status === "cancelled") {
    return { ok: false, error: "Work order was already closed before this draft synced." }
  }
  if ((current.assigned_to || null) !== payload.originalAssignedTo) {
    return { ok: false, error: "Work order assignment changed before this draft synced." }
  }

  const transition = validateWorkOrderStatusTransition(current.status as WorkOrderStatus, payload.status as WorkOrderStatus)
  if (!transition.valid) return { ok: false, error: transition.message }

  const parsed = workOrderUpdateSchema.safeParse({
    status: payload.status,
    assigned_to: payload.assignedTo || undefined,
    resolution_notes: payload.resolutionNotes || undefined,
    reason: payload.reason,
  })
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((issue) => issue.message).join(", ") }
  }

  const { reason, ...workOrderUpdateData } = parsed.data
  const updateData: Record<string, unknown> = { ...workOrderUpdateData }
  if (parsed.data.status === "in_progress") updateData.started_at = new Date().toISOString()

  const { error } = await supabase
    .schema("ebiomed")
    .from("work_orders")
    .update(updateData)
    .eq("id", payload.workOrderId)

  if (error) return { ok: false, error: error.message }

  await logAudit("work_orders", payload.workOrderId, "update", [
    { field: "status", oldValue: current.status, newValue: parsed.data.status },
  ], reason)

  if (parsed.data.status === "in_progress") {
    const { data: equip } = await supabase
      .schema("ebiomed")
      .from("equipment")
      .select("status")
      .eq("id", current.equipment_id)
      .single()

    await supabase
      .schema("ebiomed")
      .from("equipment")
      .update({ status: "under_repair", updated_at: new Date().toISOString() })
      .eq("id", current.equipment_id)

    await logAudit("equipment", current.equipment_id, "update", [
      { field: "status", oldValue: equip?.status || "unknown", newValue: "under_repair" },
    ], reason)
  }

  revalidatePath("/work-orders")
  revalidatePath(`/work-orders/${payload.workOrderId}`)
  revalidatePath("/dashboard")
  return { ok: true }
}

export async function getAssignedWorkOrders(userId: string): Promise<WorkOrder[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("work_orders")
    .select("*, equipment(*)")
    .eq("assigned_to", userId)
    .order("created_at", { ascending: false })

  return (data || []) as unknown as WorkOrder[]
}
