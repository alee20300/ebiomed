import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  WebhookNotificationProvider,
  buildNotificationSubject,
  normalizeAdapter,
  shouldAttemptDelivery,
  type NotificationAdapter,
  type NotificationChannel,
  type NotificationDeliveryStatus,
  type NotificationOutboxItem,
} from "@/lib/notifications/outbox"

const BATCH_SIZE = 25

type AdminClient = ReturnType<typeof createAdminClient>

function authorizeCron(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  return !!cronSecret && authHeader === `Bearer ${cronSecret}`
}

async function loadAdapters(supabase: AdminClient) {
  const { data, error } = await supabase
    .from("notification_adapters")
    .select("adapter, enabled, config")

  if (error) throw new Error(error.message)

  const adapters = new Map<NotificationChannel, NotificationAdapter>()
  for (const row of data || []) {
    const adapter = normalizeAdapter(row as { adapter: string; enabled: boolean; config: Record<string, unknown> | null })
    if (adapter) adapters.set(adapter.adapter, adapter)
  }
  return adapters
}

async function loadRequestNotifications(supabase: AdminClient): Promise<NotificationOutboxItem[]> {
  const { data, error } = await supabase
    .from("request_notifications")
    .select("id, reference_number, recipient_email, event, message, created_at, delivery_channel, delivery_attempts")
    .in("delivery_status", ["pending", "failed"])
    .lt("delivery_attempts", 3)
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE)

  if (error) throw new Error(error.message)

  return ((data || []) as unknown as Array<{
    id: string
    event: string
    recipient_email: string | null
    message: string
    created_at: string
    delivery_channel: string | null
    delivery_attempts: number | null
  }>).map((row) => {
    const channel = (row.delivery_channel || "email") as NotificationChannel
    return {
      source: "request_notifications",
      id: row.id,
      event: row.event,
      channel,
      recipient: channel === "email" ? row.recipient_email : null,
      subject: buildNotificationSubject({ source: "request_notifications", event: row.event }),
      message: row.message,
      createdAt: row.created_at,
      attempts: row.delivery_attempts || 0,
    }
  })
}

async function loadPmNotifications(supabase: AdminClient): Promise<NotificationOutboxItem[]> {
  const { data, error } = await supabase
    .from("pm_escalation_notifications")
    .select("id, escalation_level, recipient_user_id, recipient_department, message, sent_at, delivery_channel, delivery_attempts")
    .in("delivery_status", ["pending", "failed"])
    .lt("delivery_attempts", 3)
    .order("sent_at", { ascending: true })
    .limit(BATCH_SIZE)

  if (error) throw new Error(error.message)

  return ((data || []) as unknown as Array<{
    id: string
    escalation_level: string
    recipient_department: string | null
    message: string
    sent_at: string
    delivery_channel: string | null
    delivery_attempts: number | null
  }>).map((row) => {
    const channel = (row.delivery_channel || "email") as NotificationChannel
    return {
      source: "pm_escalation_notifications",
      id: row.id,
      event: row.escalation_level,
      channel,
      recipient: channel === "email" ? null : row.recipient_department || null,
      subject: buildNotificationSubject({ source: "pm_escalation_notifications", event: row.escalation_level }),
      message: row.message,
      createdAt: row.sent_at,
      attempts: row.delivery_attempts || 0,
    }
  })
}

async function markDelivery(
  supabase: AdminClient,
  item: NotificationOutboxItem,
  result: { status: NotificationDeliveryStatus; providerMessageId?: string | null; error?: string | null },
) {
  await supabase
    .from(item.source)
    .update({
      delivery_status: result.status,
      delivery_attempts: item.attempts + 1,
      delivered_at: result.status === "sent" ? new Date().toISOString() : null,
      last_attempt_at: new Date().toISOString(),
      last_error: result.error || null,
      provider_message_id: result.providerMessageId || null,
    })
    .eq("id", item.id)
}

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createAdminClient()
  const provider = new WebhookNotificationProvider()
  const adapters = await loadAdapters(supabase)
  const items = [
    ...(await loadRequestNotifications(supabase)),
    ...(await loadPmNotifications(supabase)),
  ].slice(0, BATCH_SIZE)

  const summary: Record<"processed" | "sent" | "skipped" | "failed", number> = { processed: 0, sent: 0, skipped: 0, failed: 0 }

  for (const item of items) {
    summary.processed++
    const precheck = shouldAttemptDelivery(item)
    if (!precheck.attempt) {
      const status = precheck.status || "failed"
      await markDelivery(supabase, item, { status, error: precheck.error })
      summary[status]++
      continue
    }

    const adapter = adapters.get(item.channel)
    const result = adapter
      ? await provider.deliver(item, adapter)
      : { status: "skipped" as const, error: `${item.channel} adapter is not configured` }
    await markDelivery(supabase, item, result)
    if (result.status !== "pending") summary[result.status]++
  }

  return NextResponse.json(summary)
}
