import { describe, expect, it } from "vitest"
import {
  createOfflineDraft,
  isTerminalWorkOrderStatus,
  jobCardEntryDraftToFormData,
  partsUsageDraftToFormData,
  summarizeOfflineDrafts,
  workOrderStatusDraftToFormData,
  type OfflineDraft,
} from "@/lib/offline/work-order-drafts"

describe("work order offline drafts", () => {
  it("creates pending drafts with timestamps", () => {
    const draft = createOfflineDraft("work_order_status", "wo-1", {
      workOrderId: "wo-1",
      status: "in_progress",
      assignedTo: "tech-1",
      resolutionNotes: null,
      reason: "Started offline",
      originalStatus: "open",
      originalAssignedTo: "tech-1",
    }, "2026-06-06T10:00:00.000Z")

    expect(draft).toMatchObject({
      workOrderId: "wo-1",
      type: "work_order_status",
      status: "pending",
      attempts: 0,
      error: null,
      createdAt: "2026-06-06T10:00:00.000Z",
      updatedAt: "2026-06-06T10:00:00.000Z",
    })
  })

  it("summarizes draft sync states", () => {
    const base = createOfflineDraft("job_card_entry", "wo-1", {
      workOrderId: "wo-1",
      jobCardId: "jc-1",
      description: "Tested output",
      startedAt: "2026-06-06T09:00",
      endedAt: "2026-06-06T10:00",
    })
    const drafts: OfflineDraft[] = [
      base,
      { ...base, id: "failed", status: "failed" },
      { ...base, id: "synced", status: "synced" },
    ]

    expect(summarizeOfflineDrafts(drafts)).toEqual({
      pending: 1,
      syncing: 0,
      failed: 1,
      synced: 1,
      total: 3,
    })
  })

  it("builds replay FormData for supported draft types", () => {
    const statusForm = workOrderStatusDraftToFormData({
      workOrderId: "wo-1",
      status: "on_hold",
      assignedTo: null,
      resolutionNotes: "Waiting for part",
      reason: "Paused offline",
      originalStatus: "in_progress",
      originalAssignedTo: null,
    })
    expect(statusForm.get("status")).toBe("on_hold")
    expect(statusForm.get("resolution_notes")).toBe("Waiting for part")
    expect(statusForm.get("assigned_to")).toBeNull()

    const entryForm = jobCardEntryDraftToFormData({
      workOrderId: "wo-1",
      jobCardId: "jc-1",
      description: "Adjusted sensor",
      startedAt: "2026-06-06T09:00",
      endedAt: "2026-06-06T09:30",
    })
    expect(entryForm.get("description")).toBe("Adjusted sensor")

    const partsForm = partsUsageDraftToFormData({
      workOrderId: "wo-1",
      partId: "part-1",
      quantityUsed: 2,
      reason: "Used during repair",
    })
    expect(partsForm.get("quantity_used")).toBe("2")
  })

  it("detects terminal statuses that need interactive re-authentication", () => {
    expect(isTerminalWorkOrderStatus("completed")).toBe(true)
    expect(isTerminalWorkOrderStatus("cancelled")).toBe(true)
    expect(isTerminalWorkOrderStatus("in_progress")).toBe(false)
  })
})
