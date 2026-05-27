"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { pmScheduleSchema } from "@/lib/schemas/pm-schedule"
import { getCurrentUser } from "@/lib/actions/profiles"
import { logAudit } from "@/lib/actions/audit"
import type { PMSchedule } from "@/lib/types"
import { addDays } from "date-fns"

export async function createPMSchedule(formData: FormData) {
  const supabase = await createClient()
  const raw = Object.fromEntries(formData)

  const checklistRaw = (formData.get("checklist") as string) || ""
  let checklist: Array<{ id: string; text: string; completed: boolean; type?: string; required?: boolean }> = []

  // Support both JSON format (from new modal) and newline format (from old form)
  if (checklistRaw.startsWith("[")) {
    try {
      checklist = JSON.parse(checklistRaw)
    } catch {
      checklist = []
    }
  } else {
    checklist = checklistRaw
      .split("\n")
      .map((text, index) => ({
        id: `check-${index}`,
        text: text.trim(),
        completed: false,
      }))
      .filter((item) => item.text.length > 0)
  }

  const activeRaw = formData.get("active")
  const active = activeRaw === "true"

  const parsed = pmScheduleSchema.safeParse({
    ...raw,
    checklist,
    active,
  })
  if (!parsed.success) {
    const messages = parsed.error.errors.map((e) => e.message).join(", ")
    return redirect(`/pm-schedules/new?error=${encodeURIComponent(messages)}`)
  }

  const nextDue = addDays(new Date(), parsed.data.frequency_days).toISOString()

  const { data, error } = await supabase.from("pm_schedules").insert({
    equipment_id: parsed.data.equipment_id,
    frequency_days: parsed.data.frequency_days,
    description: parsed.data.description,
    checklist,
    assigned_to: parsed.data.assigned_to || null,
    active: parsed.data.active,
    next_due: nextDue,
  }).select().single()

  if (error) {
    return redirect(`/pm-schedules/new?error=${encodeURIComponent(error.message)}`)
  }

  await logAudit("pm_schedules", data.id, "insert", [
    { newValue: JSON.stringify({ equipment_id: parsed.data.equipment_id, frequency_days: parsed.data.frequency_days, description: parsed.data.description, next_due: nextDue }) }
  ], parsed.data.reason)

  revalidatePath("/pm-schedules")
  revalidatePath("/dashboard")
  redirect("/pm-schedules")
}

export async function getPMSchedules(): Promise<PMSchedule[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("pm_schedules")
    .select("*, equipment(*)")
    .order("next_due", { ascending: true })

  return (data || []) as unknown as PMSchedule[]
}

export async function getPMScheduleById(id: string): Promise<PMSchedule | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("pm_schedules")
    .select("*, equipment(*)")
    .eq("id", id)
    .single()

  return data as unknown as PMSchedule
}

export async function startPMTask(pmScheduleId: string) {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) return redirect("/login")

  const { data: pm } = await supabase
    .from("pm_schedules")
    .select("*, equipment(*)")
    .eq("id", pmScheduleId)
    .single()

  if (!pm) {
    return redirect("/pm-schedules?error=PM schedule not found")
  }

  const { data: wo, error } = await supabase
    .from("work_orders")
    .insert({
      equipment_id: pm.equipment_id,
      type: "preventive",
      priority: "medium",
      status: "in_progress",
      description: pm.description || `PM: ${pm.equipment?.name || "Equipment"} (${pm.frequency_days} day cycle)`,
      assigned_to: pm.assigned_to || user.id,
      created_by: user.id,
      started_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    return redirect(`/pm-schedules?error=${encodeURIComponent(error.message)}`)
  }

  await logAudit("work_orders", wo.id, "insert", [
    { newValue: JSON.stringify({ equipment_id: pm.equipment_id, type: "preventive", description: pm.description, assigned_to: pm.assigned_to || user.id }) }
  ], "Started from PM schedule " + pmScheduleId)

  revalidatePath("/work-orders")
  revalidatePath("/pm-schedules")
  redirect(`/work-orders/${wo.id}`)
}

export async function completePMTask(workOrderId: string, pmScheduleId: string) {
  const supabase = await createClient()

  const now = new Date().toISOString()

  const { data: pm } = await supabase
    .from("pm_schedules")
    .select("frequency_days")
    .eq("id", pmScheduleId)
    .single()

  const next = pm
    ? addDays(new Date(), pm.frequency_days).toISOString()
    : addDays(new Date(), 90).toISOString()

  await supabase
    .from("pm_schedules")
    .update({ last_completed: now, next_due: next })
    .eq("id", pmScheduleId)

  await logAudit("pm_schedules", pmScheduleId, "update", [
    { field: "last_completed", newValue: now },
    { field: "next_due", newValue: next }
  ], "PM task completed")

  revalidatePath("/pm-schedules")
  revalidatePath("/dashboard")
}
