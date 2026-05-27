"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { logAudit } from "@/lib/actions/audit"
import { recordSignature } from "@/lib/actions/signatures"
import type { WorkOrder } from "@/lib/types"

export async function createWorkOrder(formData: FormData) {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) return redirect("/login")

  const raw = Object.fromEntries(formData)
  if (!raw.assigned_to) delete raw.assigned_to
  const parsed = workOrderSchema.safeParse(raw)

  if (!parsed.success) {
    const messages = parsed.error.errors.map((e) => e.message).join(", ")
    return redirect(`/work-orders/new?error=${encodeURIComponent(messages)}`)
  }

  // Validate equipment is not retired
  const { data: equip } = await supabase
    .from("equipment")
    .select("status")
    .eq("id", parsed.data.equipment_id)
    .single()

  if (equip?.status === "retired") {
    return redirect(`/work-orders/new?error=${encodeURIComponent("Cannot create work order for retired equipment")}`)
  }

  const { data, error } = await supabase.from("work_orders").insert({
    ...parsed.data,
    assigned_to: parsed.data.assigned_to || null,
    created_by: user.id,
  }).select().single()

  if (error) {
    return redirect(`/work-orders/new?error=${encodeURIComponent(error.message)}`)
  }

  await logAudit("work_orders", data.id, "insert", [
    { newValue: JSON.stringify({ equipment_id: parsed.data.equipment_id, type: parsed.data.type, priority: parsed.data.priority, description: parsed.data.description, assigned_to: parsed.data.assigned_to }) }
  ], parsed.data.reason)

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

export async function updateWorkOrderStatus(id: string, formData: FormData) {
  const supabase = await createClient()
  const raw = Object.fromEntries(formData)

  if (!raw.assigned_to) delete raw.assigned_to

  // Fetch current status to enforce lifecycle rules
  const { data: current } = await supabase
    .from("work_orders")
    .select("status, started_at")
    .eq("id", id)
    .single()

  if (!current) return redirect(`/work-orders/${id}?error=${encodeURIComponent("Work order not found")}`)

  const newStatus = raw.status as string

  // Completed or cancelled = immutable
  if (current.status === "completed" || current.status === "cancelled") {
    return redirect(`/work-orders/${id}?error=${encodeURIComponent("Cannot modify a completed or cancelled work order")}`)
  }

  // Prevent invalid transitions
  const validTransitions: Record<string, string[]> = {
    open: ["in_progress", "on_hold", "cancelled"],
    in_progress: ["on_hold", "completed", "cancelled"],
    on_hold: ["in_progress", "cancelled"],
  }

  if (newStatus && !validTransitions[current.status]?.includes(newStatus)) {
    return redirect(`/work-orders/${id}?error=${encodeURIComponent(`Invalid status transition from ${current.status} to ${newStatus}`)}`)
  }

  const parsed = workOrderUpdateSchema.safeParse(raw)
  if (!parsed.success) {
    const messages = parsed.error.errors.map((e) => e.message).join(", ")
    return redirect(`/work-orders/${id}?error=${encodeURIComponent(messages)}`)
  }

  const updateData: Record<string, unknown> = { ...parsed.data }

  if (parsed.data.status === "in_progress") {
    updateData.started_at = new Date().toISOString()
  }

  if (parsed.data.status === "completed") {
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

  const statusReason = parsed.data.reason || "Status change"
  await logAudit("work_orders", id, "update", [
    { field: "status", oldValue: current.status, newValue: newStatus }
  ], statusReason)

  // Record electronic signature for completed/cancelled
  if (parsed.data.status === "completed" || parsed.data.status === "cancelled") {
    await recordSignature(
      "work_order",
      id,
      parsed.data.status === "completed" ? "Verified" : "Reviewed"
    )
  }

  // If completed, update equipment status back to active
  if (parsed.data.status === "completed") {
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

export async function getAssignedWorkOrders(userId: string): Promise<WorkOrder[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("work_orders")
    .select("*, equipment(*)")
    .eq("assigned_to", userId)
    .order("created_at", { ascending: false })

  return (data || []) as unknown as WorkOrder[]
}
