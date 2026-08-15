import { format, formatDistanceToNow, isPast, isToday, differenceInDays } from "date-fns"

export function formatDate(date: string | null): string {
  if (!date) return "—"
  return format(new Date(date), "MMM d, yyyy")
}

export function formatDateTime(date: string | null): string {
  if (!date) return "—"
  return format(new Date(date), "MMM d, yyyy h:mm a")
}

export function formatRelative(date: string | null): string {
  if (!date) return "—"
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

export function getPMStatus(nextDue: string | null): "overdue" | "due" | "upcoming" | "none" {
  if (!nextDue) return "none"
  const due = new Date(nextDue)
  if (isPast(due)) return "overdue"
  if (isToday(due)) return "due"
  if (differenceInDays(due, new Date()) <= 7) return "upcoming"
  return "none"
}

/**
 * The five semantic tones every status and priority in the app collapses into.
 * Adding a colour outside this set is a design-system change, not a local one.
 */
export type Tone = "success" | "warning" | "danger" | "info" | "neutral"

const TONE_CLASSES: Record<Tone, string> = {
  success: "bg-success-subtle text-success-strong",
  warning: "bg-warning-subtle text-warning-strong",
  danger: "bg-danger-subtle text-danger-strong",
  info: "bg-info-subtle text-info-strong",
  neutral: "bg-neutral-subtle text-neutral-strong",
}

const STATUS_TONES: Record<string, Tone> = {
  // work orders
  open: "info",
  in_progress: "warning",
  on_hold: "warning",
  completed: "success",
  cancelled: "neutral",
  // complaints / requests
  new: "warning",
  pending_review: "warning",
  "pending review": "warning",
  triaged: "info",
  approved: "success",
  rejected: "danger",
  converted: "info",
  "converted to work order": "info",
  // equipment
  active: "success",
  inactive: "neutral",
  retired: "danger",
  under_repair: "warning",
  // calibration
  valid: "success",
  expired: "danger",
  revoked: "neutral",
  out_of_tolerance: "danger",
  certified: "success",
  // preventive maintenance
  overdue: "danger",
  due: "warning",
  upcoming: "info",
  none: "neutral",
  // inventory / audit
  ok: "success",
  low_stock: "danger",
  insert: "success",
  update: "info",
  delete: "danger",
}

const PRIORITY_TONES: Record<string, Tone> = {
  low: "neutral",
  medium: "info",
  high: "warning",
  critical: "danger",
}

export function statusTone(status: string): Tone {
  return STATUS_TONES[status] ?? "neutral"
}

export function priorityTone(priority: string): Tone {
  return PRIORITY_TONES[priority] ?? "neutral"
}

export function toneClasses(tone: Tone): string {
  return TONE_CLASSES[tone]
}

export function statusColor(status: string): string {
  return toneClasses(statusTone(status))
}

export function priorityColor(priority: string): string {
  return toneClasses(priorityTone(priority))
}
