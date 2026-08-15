export type PMTriggerType = "calendar" | "run_hours" | "cycles" | "calendar_or_usage" | "calendar_and_usage"
export type PMOccurrenceStatus = "due" | "generated" | "completed" | "missed" | "skipped"
export type PMEscalationLevel = "none" | "assignee" | "admin" | "department"

export interface PMEngineSchedule {
  id: string
  equipment_id: string
  description: string | null
  assigned_to: string | null
  trigger_type: PMTriggerType
  calendar_interval_days: number | null
  meter_interval: number | null
  cycle_interval: number | null
  risk_modifier: number
  grace_period_days: number
  escalation_policy?: PMEscalationPolicy | null
  active: boolean
  next_due: string | null
  last_completed: string | null
  equipment?: {
    name: string
    tag_number: string
    department: string | null
    run_hours: number | null
    cycle_count: number | null
  } | null
}

export interface PMEngineOccurrence {
  id: string
  pm_schedule_id: string
  equipment_id: string
  due_at: string
  trigger_type: PMTriggerType
  due_meter: number | null
  due_cycle: number | null
  status: PMOccurrenceStatus
  work_order_id: string | null
  escalation_level: PMEscalationLevel
  missed_at?: string | null
  generated_at?: string | null
}

export interface PMEscalationPolicy {
  assignee_after_days: number
  admin_after_days: number
  department_after_days: number
}

export interface PMOccurrenceCandidate {
  pm_schedule_id: string
  equipment_id: string
  due_at: string
  trigger_type: PMTriggerType
  due_meter: number | null
  due_cycle: number | null
}

export interface PMEscalationNotificationCandidate {
  pm_occurrence_id: string
  pm_schedule_id: string
  equipment_id: string
  escalation_level: Exclude<PMEscalationLevel, "none">
  recipient_type: Exclude<PMEscalationLevel, "none">
  recipient_user_id: string | null
  recipient_department: string | null
  message: string
  sent_at: string
}

const defaultEscalationPolicy: PMEscalationPolicy = {
  assignee_after_days: 0,
  admin_after_days: 2,
  department_after_days: 5,
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function effectiveCalendarDays(schedule: PMEngineSchedule) {
  const base = schedule.calendar_interval_days || 0
  if (base <= 0) return null
  return Math.max(1, Math.round(base * (schedule.risk_modifier || 1)))
}

export function getEscalationPolicy(schedule: Pick<PMEngineSchedule, "escalation_policy">): PMEscalationPolicy {
  return {
    ...defaultEscalationPolicy,
    ...(schedule.escalation_policy || {}),
  }
}

export function getNextCalendarDueAt(schedule: PMEngineSchedule, nowIso: string): string | null {
  const interval = effectiveCalendarDays(schedule)
  if (!interval) return null
  const anchor = schedule.next_due || schedule.last_completed || nowIso
  return addDays(new Date(anchor), schedule.next_due ? 0 : interval).toISOString()
}

export function getOccurrenceGenerationState(
  occurrence: Pick<PMEngineOccurrence, "due_at" | "status" | "work_order_id">,
  gracePeriodDays: number,
  hasOpenWorkOrderForSchedule: boolean,
  nowIso: string
) {
  const nextStatus = getOccurrenceStatusAfterGrace(occurrence, gracePeriodDays, nowIso)
  return {
    nextStatus,
    shouldGenerate: shouldGenerateWorkOrder({ ...occurrence, status: nextStatus }, hasOpenWorkOrderForSchedule),
  }
}

export function shouldCreateOccurrence(
  schedule: PMEngineSchedule,
  openOccurrence: PMEngineOccurrence | undefined,
  nowIso: string
): PMOccurrenceCandidate | null {
  if (!schedule.active || openOccurrence) return null

  const equipment = schedule.equipment
  const triggerType = schedule.trigger_type || "calendar"
  const calendarDueAt = getNextCalendarDueAt(schedule, nowIso)
  const calendarDue = !!calendarDueAt && new Date(calendarDueAt).getTime() <= new Date(nowIso).getTime()
  const runHours = equipment?.run_hours ?? null
  const cycles = equipment?.cycle_count ?? null
  const meterDue = schedule.meter_interval !== null && runHours !== null && runHours >= schedule.meter_interval
  const cycleDue = schedule.cycle_interval !== null && cycles !== null && cycles >= schedule.cycle_interval

  if (triggerType === "calendar" && !calendarDue) return null
  if (triggerType === "run_hours" && !meterDue) return null
  if (triggerType === "cycles" && !cycleDue) return null
  if (triggerType === "calendar_or_usage" && !calendarDue && !meterDue && !cycleDue) return null
  if (triggerType === "calendar_and_usage" && (!calendarDue || (!meterDue && !cycleDue))) return null

  return {
    pm_schedule_id: schedule.id,
    equipment_id: schedule.equipment_id,
    due_at: calendarDueAt || nowIso,
    trigger_type: triggerType,
    due_meter: meterDue ? schedule.meter_interval : null,
    due_cycle: cycleDue ? schedule.cycle_interval : null,
  }
}

export function shouldGenerateWorkOrder(
  occurrence: Pick<PMEngineOccurrence, "status" | "work_order_id">,
  hasOpenWorkOrderForSchedule: boolean
): boolean {
  return (occurrence.status === "due" || occurrence.status === "missed") && !occurrence.work_order_id && !hasOpenWorkOrderForSchedule
}

export function getOccurrenceStatusAfterGrace(
  occurrence: Pick<PMEngineOccurrence, "status" | "due_at">,
  gracePeriodDays: number,
  nowIso: string
): PMOccurrenceStatus {
  if (occurrence.status !== "due" && occurrence.status !== "generated") return occurrence.status
  const graceEnds = addDays(new Date(occurrence.due_at), gracePeriodDays)
  return graceEnds.getTime() < new Date(nowIso).getTime() ? "missed" : occurrence.status
}

export function getEscalationLevel(
  occurrence: Pick<PMEngineOccurrence, "due_at" | "escalation_level" | "status">,
  policy: PMEscalationPolicy,
  nowIso: string
): PMEscalationLevel {
  if (occurrence.status === "completed" || occurrence.status === "skipped") return occurrence.escalation_level
  const ageDays = Math.floor((new Date(nowIso).getTime() - new Date(occurrence.due_at).getTime()) / 86_400_000)
  if (ageDays >= policy.department_after_days) return "department"
  if (ageDays >= policy.admin_after_days) return "admin"
  if (ageDays >= policy.assignee_after_days) return "assignee"
  return "none"
}

export function validateEscalationPolicy(policy: PMEscalationPolicy): string[] {
  const messages: string[] = []
  if (policy.assignee_after_days > policy.admin_after_days) {
    messages.push("Assignee escalation must happen before admin escalation")
  }
  if (policy.admin_after_days > policy.department_after_days) {
    messages.push("Admin escalation must happen before department escalation")
  }
  return messages
}

export function getNextDueAfterCompletion(schedule: PMEngineSchedule, completedAtIso: string): string | null {
  const interval = effectiveCalendarDays(schedule)
  return interval ? addDays(new Date(completedAtIso), interval).toISOString() : null
}

export function buildEscalationNotification(
  occurrence: Pick<PMEngineOccurrence, "id" | "pm_schedule_id" | "equipment_id" | "due_at">,
  schedule: Pick<PMEngineSchedule, "assigned_to" | "description" | "equipment">,
  escalationLevel: PMEscalationLevel,
  sentAtIso: string
): PMEscalationNotificationCandidate | null {
  if (escalationLevel === "none") return null

  const equipment = schedule.equipment
  const asset = equipment ? `${equipment.name} (${equipment.tag_number})` : "equipment"
  const message = `${schedule.description || "Preventive maintenance"} is overdue for ${asset}; due ${occurrence.due_at}.`

  return {
    pm_occurrence_id: occurrence.id,
    pm_schedule_id: occurrence.pm_schedule_id,
    equipment_id: occurrence.equipment_id,
    escalation_level: escalationLevel,
    recipient_type: escalationLevel,
    recipient_user_id: escalationLevel === "assignee" ? schedule.assigned_to : null,
    recipient_department: escalationLevel === "department" ? equipment?.department || null : null,
    message,
    sent_at: sentAtIso,
  }
}
