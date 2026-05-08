"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { workOrderSchema, workOrderUpdateSchema } from "@/lib/schemas/work-order"
import { getCurrentUser } from "@/lib/actions/profiles"
import type { WorkOrder } from "@/lib/types"

export async function createWorkOrder(formData: FormData) {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) return redirect("/login")

  const raw = Object.fromEntries(formData)
  const parsed = workOrderSchema.safeParse(raw)

  if (!parsed.success) {
    const messages = parsed.error.errors.map((e) => e.message).join(", ")
    return redirect(`/work-orders/new?error=${encodeURIComponent(messages)}`)
  }

  const { error } = await supabase.from("work_orders").insert({
    ...parsed.data,
    created_by: user.id,
  })

  if (error) {
    return redirect(`/work-orders/new?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath("/work-orders")
  revalidatePath("/dashboard")
  redirect("/work-orders")
}

export async function getWorkOrders(): Promise<WorkOrder[]> {
  const supabase = await createClient()
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
  }

  const { error } = await supabase
    .from("work_orders")
    .update(updateData)
    .eq("id", id)

  if (error) {
    return redirect(`/work-orders/${id}?error=${encodeURIComponent(error.message)}`)
  }

  // If completed, update equipment status back to active
  if (parsed.data.status === "completed") {
    const { data: wo } = await supabase
      .from("work_orders")
      .select("equipment_id")
      .eq("id", id)
      .single()

    if (wo) {
      await supabase
        .from("equipment")
        .update({ status: "active", updated_at: new Date().toISOString() })
        .eq("id", wo.equipment_id)
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
