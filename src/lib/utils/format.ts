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

export function statusColor(status: string): string {
  switch (status) {
    case "open": return "bg-blue-100 text-blue-800"
    case "in_progress": return "bg-yellow-100 text-yellow-800"
    case "on_hold": return "bg-orange-100 text-orange-800"
    case "completed": return "bg-green-100 text-green-800"
    case "cancelled": return "bg-gray-100 text-gray-800"
    case "active": return "bg-green-100 text-green-800"
    case "inactive": return "bg-gray-100 text-gray-800"
    case "retired": return "bg-red-100 text-red-800"
    case "under_repair": return "bg-purple-100 text-purple-800"
    case "out_of_tolerance": return "bg-red-100 text-red-800"
    case "certified": return "bg-emerald-100 text-emerald-800"
    default: return "bg-gray-100 text-gray-800"
  }
}

export function priorityColor(priority: string): string {
  switch (priority) {
    case "low": return "bg-gray-100 text-gray-700"
    case "medium": return "bg-blue-100 text-blue-700"
    case "high": return "bg-orange-100 text-orange-700"
    case "critical": return "bg-red-100 text-red-700"
    default: return "bg-gray-100 text-gray-700"
  }
}
