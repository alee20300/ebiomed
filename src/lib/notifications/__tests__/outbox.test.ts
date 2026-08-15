import { describe, expect, it, vi } from "vitest"
import {
  WebhookNotificationProvider,
  buildNotificationSubject,
  normalizeAdapter,
  shouldAttemptDelivery,
  type NotificationOutboxItem,
} from "@/lib/notifications/outbox"

const baseItem: NotificationOutboxItem = {
  source: "request_notifications",
  id: "notification-1",
  event: "submitted",
  channel: "email",
  recipient: "requester@example.com",
  subject: "Subject",
  message: "Message",
  createdAt: "2026-08-13T00:00:00.000Z",
  attempts: 0,
}

describe("notification outbox", () => {
  it("normalizes known adapters and rejects unknown adapters", () => {
    expect(normalizeAdapter({ adapter: "email", enabled: true, config: { webhook_url: "https://example.test" } })).toEqual({
      adapter: "email",
      enabled: true,
      config: { webhook_url: "https://example.test" },
    })
    expect(normalizeAdapter({ adapter: "fax", enabled: true, config: {} })).toBeNull()
  })

  it("skips records with no recipient unless they are in-app", () => {
    expect(shouldAttemptDelivery({ attempts: 0, channel: "email", recipient: null })).toEqual({
      attempt: false,
      status: "skipped",
      error: "No recipient configured",
    })
    expect(shouldAttemptDelivery({ attempts: 0, channel: "in_app", recipient: null })).toEqual({ attempt: true })
  })

  it("delivers through configured webhook adapters", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 202, headers: { "x-message-id": "msg-1" } }))
    vi.stubGlobal("fetch", fetchMock)

    const provider = new WebhookNotificationProvider()
    await expect(provider.deliver(baseItem, {
      adapter: "email",
      enabled: true,
      config: { webhook_url: "https://notify.example.test/send" },
    })).resolves.toEqual({ status: "sent", providerMessageId: "msg-1" })

    expect(fetchMock).toHaveBeenCalledWith("https://notify.example.test/send", expect.objectContaining({ method: "POST" }))
    vi.unstubAllGlobals()
  })

  it("builds readable subjects for request and PM messages", () => {
    expect(buildNotificationSubject({ source: "request_notifications", event: "approved" })).toBe("Biomedical request approved")
    expect(buildNotificationSubject({ source: "pm_escalation_notifications", event: "admin" })).toBe("Biomedical PM escalation admin")
  })
})
