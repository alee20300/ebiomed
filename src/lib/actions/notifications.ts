"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/lib/actions/profiles"

type NotificationSource = "request_notifications" | "pm_escalation_notifications"

export type ShellNotification = {
  id: string
  source: NotificationSource
  title: string
  message: string
  createdAt: string
  readAt: string | null
  deliveryStatus: string
  href: string
}

type RequestNotificationRow = {
  id: string
  complaint_id: string
  reference_number: string
  recipient_email: string | null
  event: string
  message: string
  created_at: string
  read_at: string | null
  delivery_status: string
}

type PmNotificationRow = {
  id: string
  pm_schedule_id: string
  escalation_level: string
  recipient_user_id: string | null
  recipient_department: string | null
  message: string
  sent_at: string
  read_at: string | null
  delivery_status: string
}

function requestTitle(event: string, reference: string) {
  return `${reference} ${event.replaceAll("_", " ")}`
}

function pmTitle(level: string) {
  return `PM escalation: ${level.replaceAll("_", " ")}`
}

export async function getShellNotifications(limit = 12) {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) return { notifications: [] as ShellNotification[], unreadCount: 0 }

  const [requestResult, pmResult] = await Promise.all([
    supabase
      .schema("ebiomed")
      .from("request_notifications")
      .select("id, complaint_id, reference_number, recipient_email, event, message, created_at, read_at, delivery_status")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .schema("ebiomed")
      .from("pm_escalation_notifications")
      .select("id, pm_schedule_id, escalation_level, recipient_user_id, recipient_department, message, sent_at, read_at, delivery_status")
      .order("sent_at", { ascending: false })
      .limit(50),
  ])

  const canSeeOperationalNotifications = user.role === "admin" || user.role === "technician"
  const requestRows = ((requestResult.data || []) as RequestNotificationRow[]).filter((row) => {
    if (canSeeOperationalNotifications) return true
    return row.recipient_email?.toLowerCase() === user.email?.toLowerCase()
  })
  const pmRows = ((pmResult.data || []) as PmNotificationRow[]).filter((row) => {
    if (user.role === "admin") return true
    return row.recipient_user_id === user.id || (!!user.department && row.recipient_department === user.department)
  })

  const notifications: ShellNotification[] = [
    ...requestRows.map((row) => ({
      id: row.id,
      source: "request_notifications" as const,
      title: requestTitle(row.event, row.reference_number),
      message: row.message,
      createdAt: row.created_at,
      readAt: row.read_at,
      deliveryStatus: row.delivery_status,
      href: `/complaints/${row.complaint_id}`,
    })),
    ...pmRows.map((row) => ({
      id: row.id,
      source: "pm_escalation_notifications" as const,
      title: pmTitle(row.escalation_level),
      message: row.message,
      createdAt: row.sent_at,
      readAt: row.read_at,
      deliveryStatus: row.delivery_status,
      href: `/pm-schedules/${row.pm_schedule_id}`,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return {
    notifications: notifications.slice(0, limit),
    unreadCount: notifications.filter((notification) => !notification.readAt).length,
  }
}

export async function markNotificationRead(formData: FormData) {
  const supabase = await createClient()
  const source = formData.get("source")?.toString()
  const id = formData.get("id")?.toString()

  if ((source !== "request_notifications" && source !== "pm_escalation_notifications") || !id) return

  const { notifications } = await getShellNotifications(100)
  const canUpdate = notifications.some(
    (notification) => notification.source === source && notification.id === id
  )

  if (!canUpdate) return

  await supabase
    .schema("ebiomed")
    .from(source)
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)

  revalidatePath("/dashboard")
  revalidatePath("/requests")
  revalidatePath("/pm-schedules")
}

export async function markAllNotificationsRead() {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) return

  const now = new Date().toISOString()
  const { notifications } = await getShellNotifications(100)
  const requestIds = notifications
    .filter((notification) => notification.source === "request_notifications" && !notification.readAt)
    .map((notification) => notification.id)
  const pmIds = notifications
    .filter((notification) => notification.source === "pm_escalation_notifications" && !notification.readAt)
    .map((notification) => notification.id)

  await Promise.all([
    requestIds.length > 0
      ? supabase.schema("ebiomed").from("request_notifications").update({ read_at: now }).in("id", requestIds)
      : Promise.resolve(),
    pmIds.length > 0
      ? supabase.schema("ebiomed").from("pm_escalation_notifications").update({ read_at: now }).in("id", pmIds)
      : Promise.resolve(),
  ])

  revalidatePath("/dashboard")
  revalidatePath("/requests")
  revalidatePath("/pm-schedules")
}
