export type NotificationChannel = "email" | "sms" | "whatsapp" | "webhook" | "in_app"
export type NotificationDeliveryStatus = "pending" | "sent" | "failed" | "skipped"

export interface NotificationAdapter {
  adapter: NotificationChannel
  enabled: boolean
  config: Record<string, unknown>
}

export interface NotificationOutboxItem {
  source: "request_notifications" | "pm_escalation_notifications"
  id: string
  event: string
  channel: NotificationChannel
  recipient: string | null
  subject: string
  message: string
  createdAt: string
  attempts: number
}

export interface NotificationDeliveryResult {
  status: NotificationDeliveryStatus
  providerMessageId?: string | null
  error?: string | null
}

export interface NotificationProvider {
  deliver(item: NotificationOutboxItem, adapter: NotificationAdapter): Promise<NotificationDeliveryResult>
}

export const MAX_NOTIFICATION_ATTEMPTS = 3

export function normalizeAdapter(raw: {
  adapter: string
  enabled: boolean
  config: Record<string, unknown> | null
}): NotificationAdapter | null {
  if (!["email", "sms", "whatsapp", "webhook", "in_app"].includes(raw.adapter)) return null
  return {
    adapter: raw.adapter as NotificationChannel,
    enabled: raw.enabled,
    config: raw.config || {},
  }
}

export function shouldAttemptDelivery(item: Pick<NotificationOutboxItem, "attempts" | "channel" | "recipient">) {
  if (item.attempts >= MAX_NOTIFICATION_ATTEMPTS) {
    return { attempt: false, status: "failed" as const, error: "Maximum delivery attempts reached" }
  }
  if (item.channel !== "in_app" && !item.recipient) {
    return { attempt: false, status: "skipped" as const, error: "No recipient configured" }
  }
  return { attempt: true }
}

export class WebhookNotificationProvider implements NotificationProvider {
  async deliver(item: NotificationOutboxItem, adapter: NotificationAdapter): Promise<NotificationDeliveryResult> {
    if (!adapter.enabled) {
      return { status: "skipped", error: `${adapter.adapter} adapter is disabled` }
    }

    if (item.channel === "in_app") {
      return { status: "sent", providerMessageId: `in_app:${item.id}` }
    }

    const endpoint = typeof adapter.config.webhook_url === "string" ? adapter.config.webhook_url : ""
    if (!endpoint) {
      return { status: "skipped", error: `${adapter.adapter} webhook_url is not configured` }
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        source: item.source,
        event: item.event,
        channel: item.channel,
        recipient: item.recipient,
        subject: item.subject,
        message: item.message,
        createdAt: item.createdAt,
      }),
    })

    if (!response.ok) {
      return { status: "failed", error: `Provider returned ${response.status}` }
    }

    const providerMessageId = response.headers.get("x-message-id") || `webhook:${item.id}`
    return { status: "sent", providerMessageId }
  }
}

export function buildNotificationSubject(item: Pick<NotificationOutboxItem, "source" | "event">) {
  if (item.source === "request_notifications") {
    return `Biomedical request ${item.event}`
  }
  return `Biomedical PM escalation ${item.event}`
}
