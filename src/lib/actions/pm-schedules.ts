"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { logAudit } from "@/lib/actions/audit"
import { recordSignature } from "@/lib/actions/signatures"
import { pmScheduleSchema } from "@/lib/schemas/pm-schedule"
import { getCurrentUser } from "@/lib/actions/profiles"
import { generatePMWorkOrders } from "@/lib/actions/pm-engine"
import { requirePermission } from "@/lib/actions/permissions"
import type { PMSchedule } from "@/lib/types"
import { addDays } from "date-fns"

export async function createPMSchedule(formData: FormData) {
  const supabase = await createClient()
  await requirePermission({ action: "write", resource: "pm_schedules" }, "/pm-schedules/new")
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
    const messages = parsed.error.issues.map((e) => e.message).join(", ")
    return redirect(`/pm-schedules/new?error=${encodeURIComponent(messages)}`)
  }

  const { data: equipment } = await supabase
    .from("equipment")
    .select("status, lifecycle_stage, decommissioning_status")
    .eq("id", parsed.data.equipment_id)
    .single()

  if (equipment?.status === "retired" || equipment?.lifecycle_stage === "retired" || equipment?.decommissioning_status === "completed") {
    return redirect(`/pm-schedules/new?error=${encodeURIComponent("Cannot create PM schedule for retired or decommissioned equipment")}`)
  }

  const calendarIntervalDays = parsed.data.calendar_interval_days || parsed.data.frequency_days
  const nextDue = parsed.data.first_due_date
    ? new Date(parsed.data.first_due_date).toISOString()
    : addDays(new Date(), calendarIntervalDays).toISOString()
  const escalationPolicy = {
    assignee_after_days: parsed.data.escalation_assignee_after_days,
    admin_after_days: parsed.data.escalation_admin_after_days,
    department_after_days: parsed.data.escalation_department_after_days,
  }

  const { data, error } = await supabase.from("pm_schedules").insert({
    equipment_id: parsed.data.equipment_id,
    frequency_days: parsed.data.frequency_days,
    trigger_type: parsed.data.trigger_type,
    calendar_interval_days: calendarIntervalDays,
    meter_interval: parsed.data.meter_interval || null,
    cycle_interval: parsed.data.cycle_interval || null,
    risk_modifier: parsed.data.risk_modifier,
    grace_period_days: parsed.data.grace_period_days,
    escalation_policy: escalationPolicy,
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
  await requirePermission({ action: "run", resource: "pm_schedules" }, "/pm-schedules")

  const { data: pm } = await supabase
    .from("pm_schedules")
    .select("*, equipment(*), occurrences:pm_occurrences(*)")
    .eq("id", pmScheduleId)
    .single()

  if (!pm) {
    return redirect("/pm-schedules?error=PM schedule not found")
  }

  const openOccurrence = (pm.occurrences || []).find((occ: { status: string }) => occ.status === "due" || occ.status === "generated")
  let occurrenceId = openOccurrence?.id as string | undefined

  if (!occurrenceId) {
    const nowIso = new Date().toISOString()
    const { data: occurrence } = await supabase
      .from("pm_occurrences")
      .insert({
        pm_schedule_id: pm.id,
        equipment_id: pm.equipment_id,
        due_at: pm.next_due || nowIso,
        trigger_type: pm.trigger_type || "calendar",
        due_meter: pm.meter_interval || null,
        due_cycle: pm.cycle_interval || null,
      })
      .select("id")
      .single()
    occurrenceId = occurrence?.id
  }

  const { data: existingOpen } = await supabase
    .from("work_orders")
    .select("id")
    .eq("pm_schedule_id", pmScheduleId)
    .in("status", ["open", "in_progress", "on_hold"])
    .limit(1)

  if (existingOpen?.[0]?.id) {
    redirect(`/work-orders/${existingOpen[0].id}`)
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
      pm_schedule_id: pm.id,
      pm_occurrence_id: occurrenceId || null,
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

  if (occurrenceId) {
    await supabase
      .from("pm_occurrences")
      .update({ status: "generated", work_order_id: wo.id, generated_at: new Date().toISOString() })
      .eq("id", occurrenceId)
  }

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

  await recordSignature("pm_schedule", pmScheduleId, "Verified", "PM task completed")

  await supabase
    .from("pm_occurrences")
    .update({ status: "completed", completed_at: now, work_order_id: workOrderId })
    .eq("pm_schedule_id", pmScheduleId)
    .eq("work_order_id", workOrderId)

  await generatePMWorkOrders(now)

  revalidatePath("/pm-schedules")
  revalidatePath("/dashboard")
}
