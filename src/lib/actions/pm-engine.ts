"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { logAudit } from "@/lib/actions/audit"
import { getCurrentUser } from "@/lib/actions/profiles"
import { requirePermission } from "@/lib/actions/permissions"
import { recordSignature } from "@/lib/actions/signatures"
import { pmOccurrenceSkipSchema } from "@/lib/schemas/pm-schedule"
import {
  buildEscalationNotification,
  getEscalationLevel,
  getOccurrenceGenerationState,
  getEscalationPolicy,
  getNextDueAfterCompletion,
  getOccurrenceStatusAfterGrace,
  shouldCreateOccurrence,
  type PMEngineOccurrence,
  type PMEngineSchedule,
} from "@/lib/pm/engine"

const OPEN_PM_STATUSES = ["open", "in_progress", "on_hold"]
const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000"

type PMDatabaseClient = Awaited<ReturnType<typeof createClient>>

interface PMRunFailure {
  scope: string
  id?: string
  message: string
}

export interface PMEngineRunResult {
  checked: number
  createdOccurrences: number
  processed: number
  generated: number
  escalated: number
  missed: number
  failures: number
  failureDetails: PMRunFailure[]
}

async function getDefaultTechnicianId(supabase: PMDatabaseClient) {
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .in("role", ["admin", "technician"])
    .limit(1)
  return data?.[0]?.id || null
}

export async function generatePMOccurrences(nowIso = new Date().toISOString()) {
  const supabase = await createClient()
  return generatePMOccurrencesWithClient(supabase, nowIso)
}

export async function generatePMOccurrencesWithClient(supabase: PMDatabaseClient, nowIso = new Date().toISOString()) {
  const { data: schedules } = await supabase
    .from("pm_schedules")
    .select("*, equipment:equipment_id(name, tag_number, department, run_hours, cycle_count)")
    .eq("active", true)
    .is("deleted_at", null)

  if (!schedules?.length) return { checked: 0, created: 0, failures: 0, failureDetails: [] as PMRunFailure[] }

  const { data: openOccurrences } = await supabase
    .from("pm_occurrences")
    .select("id, pm_schedule_id, equipment_id, due_at, trigger_type, due_meter, due_cycle, status, work_order_id, escalation_level")
    .in("status", ["due", "generated"])

  const openBySchedule = new Map<string, PMEngineOccurrence>()
  for (const occurrence of (openOccurrences || []) as unknown as PMEngineOccurrence[]) {
    openBySchedule.set(occurrence.pm_schedule_id, occurrence)
  }

  let created = 0
  let failures = 0
  const failureDetails: PMRunFailure[] = []
  for (const schedule of schedules as unknown as PMEngineSchedule[]) {
    const candidate = shouldCreateOccurrence(schedule, openBySchedule.get(schedule.id), nowIso)
    if (!candidate) continue

    const { error } = await supabase
      .from("pm_occurrences")
      .insert(candidate)

    if (!error) created++
    else {
      failures++
      failureDetails.push({ scope: "pm_occurrence", id: schedule.id, message: error.message })
    }
  }

  return { checked: schedules.length, created, failures, failureDetails }
}

export async function generatePMWorkOrders(nowIso = new Date().toISOString()) {
  const supabase = await createClient()
  return generatePMWorkOrdersWithClient(supabase, nowIso)
}

export async function runPMEngineNow() {
  const user = await getCurrentUser()
  if (!user) return redirect("/login")
  await requirePermission({ action: "run", resource: "pm_schedules" }, "/pm-schedules")

  await generatePMWorkOrders()
  revalidatePath("/pm-schedules")
  revalidatePath("/dashboard")
  revalidatePath("/work-orders")
}

export async function generatePMWorkOrdersWithClient(supabase: PMDatabaseClient, nowIso = new Date().toISOString()) {
  const startedAt = nowIso
  const occurrenceResult = await generatePMOccurrencesWithClient(supabase, nowIso)

  const { data: occurrences } = await supabase
    .from("pm_occurrences")
    .select("*, schedule:pm_schedule_id(*, equipment:equipment_id(name, tag_number, department, run_hours, cycle_count))")
    .in("status", ["due", "generated"])
    .order("due_at", { ascending: true })

  if (!occurrences?.length) {
    const result: PMEngineRunResult = {
      checked: occurrenceResult.checked,
      createdOccurrences: occurrenceResult.created,
      processed: 0,
      generated: 0,
      escalated: 0,
      missed: 0,
      failures: occurrenceResult.failures,
      failureDetails: occurrenceResult.failureDetails,
    }
    await recordPMEngineRun(supabase, startedAt, result)
    return result
  }

  const defaultTechId = await getDefaultTechnicianId(supabase)
  let generated = 0
  let escalated = 0
  let missed = 0
  let failures = occurrenceResult.failures
  const failureDetails = [...occurrenceResult.failureDetails]

  for (const occurrence of occurrences as unknown as Array<PMEngineOccurrence & { schedule: PMEngineSchedule }>) {
    const schedule = occurrence.schedule
    const policy = getEscalationPolicy(schedule)
    const nextStatus = getOccurrenceStatusAfterGrace(occurrence, schedule.grace_period_days || 0, nowIso)
    const nextEscalation = getEscalationLevel(occurrence, policy, nowIso)

    const update: Record<string, unknown> = {}
    if (nextStatus !== occurrence.status) {
      update.status = nextStatus
      if (nextStatus === "missed") update.missed_at = nowIso
      missed++
    }
    if (nextEscalation !== occurrence.escalation_level) {
      update.escalation_level = nextEscalation
      update.last_escalated_at = nowIso
      escalated++
    }
    if (Object.keys(update).length > 0) {
      const { error: occurrenceUpdateError } = await supabase.from("pm_occurrences").update(update).eq("id", occurrence.id)
      if (occurrenceUpdateError) {
        failures++
        failureDetails.push({ scope: "pm_occurrence_update", id: occurrence.id, message: occurrenceUpdateError.message })
      }
    }
    if (nextEscalation !== occurrence.escalation_level && nextEscalation !== "none") {
      const notification = buildEscalationNotification(occurrence, schedule, nextEscalation, nowIso)
      if (notification) {
        const { error: notificationError } = await supabase
          .from("pm_escalation_notifications")
          .upsert(notification, { onConflict: "pm_occurrence_id,escalation_level,recipient_type", ignoreDuplicates: true })
        if (notificationError) {
          failures++
          failureDetails.push({ scope: "pm_escalation_notification", id: occurrence.id, message: notificationError.message })
        }
      }
    }

    const { data: openWo } = await supabase
      .from("work_orders")
      .select("id")
      .eq("pm_schedule_id", occurrence.pm_schedule_id)
      .in("status", OPEN_PM_STATUSES)
      .limit(1)

    const generation = getOccurrenceGenerationState(
      occurrence,
      schedule.grace_period_days || 0,
      (openWo || []).length > 0,
      nowIso
    )
    if (!generation.shouldGenerate) continue

    const equipment = schedule.equipment
    const { data: wo, error } = await supabase
      .from("work_orders")
      .insert({
        equipment_id: occurrence.equipment_id,
        type: "preventive",
        priority: nextEscalation === "department" || nextEscalation === "admin" ? "high" : "medium",
        status: "open",
        description: schedule.description || `PM due for ${equipment?.name || "equipment"} (${equipment?.tag_number || "no tag"})`,
        assigned_to: schedule.assigned_to || defaultTechId,
        created_by: defaultTechId || schedule.assigned_to || SYSTEM_USER_ID,
        pm_schedule_id: occurrence.pm_schedule_id,
        pm_occurrence_id: occurrence.id,
      })
      .select("id")
      .single()

    if (!error && wo) {
      generated++
      const { error: occurrenceLinkError } = await supabase
        .from("pm_occurrences")
        .update({
          status: nextStatus === "missed" ? "missed" : "generated",
          work_order_id: wo.id,
          generated_at: nowIso,
          missed_at: nextStatus === "missed" ? nowIso : occurrence.missed_at || null,
        })
        .eq("id", occurrence.id)
      if (occurrenceLinkError) {
        failures++
        failureDetails.push({ scope: "pm_occurrence_link", id: occurrence.id, message: occurrenceLinkError.message })
      }
      const equipmentReset: Record<string, number> = {}
      if (occurrence.due_meter !== null) equipmentReset.run_hours = 0
      if (occurrence.due_cycle !== null) equipmentReset.cycle_count = 0
      if (Object.keys(equipmentReset).length > 0) {
        const { error: equipmentResetError } = await supabase.from("equipment").update(equipmentReset).eq("id", occurrence.equipment_id)
        if (equipmentResetError) {
          failures++
          failureDetails.push({ scope: "equipment_usage_reset", id: occurrence.equipment_id, message: equipmentResetError.message })
        }
      }
    } else if (error) {
      failures++
      failureDetails.push({ scope: "pm_work_order", id: occurrence.id, message: error.message })
    }
  }

  const result: PMEngineRunResult = {
    checked: occurrenceResult.checked,
    createdOccurrences: occurrenceResult.created,
    processed: occurrences.length,
    generated,
    escalated,
    missed,
    failures,
    failureDetails,
  }
  await recordPMEngineRun(supabase, startedAt, result)
  return result
}

async function recordPMEngineRun(supabase: PMDatabaseClient, startedAt: string, result: PMEngineRunResult) {
  const status = result.failures === 0 ? "success" : result.generated > 0 || result.createdOccurrences > 0 ? "partial_failure" : "failed"
  await supabase
    .from("pm_engine_runs")
    .insert({
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      status,
      checked_schedules: result.checked,
      created_occurrences: result.createdOccurrences,
      processed_occurrences: result.processed,
      generated_work_orders: result.generated,
      escalations: result.escalated,
      missed_occurrences: result.missed,
      failures: result.failures,
      failure_details: result.failureDetails,
      triggered_by: "cron",
    })
}

export async function completePMOccurrenceForWorkOrder(workOrderId: string, completedAtIso = new Date().toISOString()) {
  const supabase = await createClient()
  const { data: wo } = await supabase
    .from("work_orders")
    .select("id, pm_schedule_id, pm_occurrence_id")
    .eq("id", workOrderId)
    .single()

  if (!wo?.pm_schedule_id || !wo.pm_occurrence_id) return

  const { data: schedule } = await supabase
    .from("pm_schedules")
    .select("*, equipment:equipment_id(name, tag_number, department, run_hours, cycle_count)")
    .eq("id", wo.pm_schedule_id)
    .single()

  await supabase
    .from("pm_occurrences")
    .update({ status: "completed", completed_at: completedAtIso, work_order_id: workOrderId })
    .eq("id", wo.pm_occurrence_id)

  if (schedule) {
    const nextDue = getNextDueAfterCompletion(schedule as unknown as PMEngineSchedule, completedAtIso)
    await supabase
      .from("pm_schedules")
      .update({ last_completed: completedAtIso, next_due: nextDue })
      .eq("id", wo.pm_schedule_id)
  }
}

export async function skipPMOccurrence(id: string, formData: FormData) {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) return redirect("/login")
  await requirePermission({ action: "skip", resource: "pm_schedules" }, "/pm-schedules")

  const parsed = pmOccurrenceSkipSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    const messages = parsed.error.issues.map((e) => e.message).join(", ")
    throw new Error(messages)
  }

  const { data: occurrence } = await supabase
    .from("pm_occurrences")
    .select("*, schedule:pm_schedule_id(*)")
    .eq("id", id)
    .single()

  if (!occurrence) throw new Error("PM occurrence not found")
  if (!["due", "generated", "missed"].includes(occurrence.status)) {
    throw new Error("Only open PM occurrences can be skipped")
  }
  if (occurrence.work_order_id) {
    throw new Error("PM occurrences with generated work orders must be closed through the work order")
  }

  const now = new Date().toISOString()
  await supabase
    .from("pm_occurrences")
    .update({
      status: "skipped",
      skipped_at: now,
      skipped_by: user.id,
      skip_reason: parsed.data.reason,
      updated_at: now,
    })
    .eq("id", id)

  await logAudit("pm_occurrences", id, "update", [
    { field: "status", oldValue: occurrence.status, newValue: "skipped" },
  ], parsed.data.reason)

  await recordSignature("pm_occurrence", id, "Reviewed", parsed.data.reason)

  const schedule = occurrence.schedule as PMEngineSchedule | null
  if (schedule) {
    const nextDue = getNextDueAfterCompletion(schedule, now)
    await supabase
      .from("pm_schedules")
      .update({ next_due: nextDue, updated_at: now })
      .eq("id", occurrence.pm_schedule_id)
  }

  revalidatePath("/pm-schedules")
  revalidatePath("/dashboard")
  redirect("/pm-schedules")
}
