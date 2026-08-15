import { describe, expect, it } from "vitest"
import {
  getWorkOrderCloseoutRequirements,
  requiresWorkOrderReauth,
  validateWorkOrderCloseout,
  validateWorkOrderStatusTransition,
} from "@/lib/utils/work-order-lifecycle"

describe("work order lifecycle rules", () => {
  it("allows valid active transitions", () => {
    expect(validateWorkOrderStatusTransition("open", "in_progress")).toEqual({ valid: true })
    expect(validateWorkOrderStatusTransition("in_progress", "completed")).toEqual({ valid: true })
    expect(validateWorkOrderStatusTransition("on_hold", "cancelled")).toEqual({ valid: true })
  })

  it("rejects invalid status transitions", () => {
    const result = validateWorkOrderStatusTransition("open", "completed")
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.message).toContain("Invalid status transition")
    }
  })

  it("keeps completed and cancelled work orders immutable", () => {
    expect(validateWorkOrderStatusTransition("completed", "in_progress").valid).toBe(false)
    expect(validateWorkOrderStatusTransition("cancelled", "in_progress").valid).toBe(false)
  })

  it("requires re-authentication for terminal status changes", () => {
    expect(requiresWorkOrderReauth("completed")).toBe(true)
    expect(requiresWorkOrderReauth("cancelled")).toBe(true)
    expect(requiresWorkOrderReauth("in_progress")).toBe(false)
    expect(requiresWorkOrderReauth(undefined)).toBe(false)
  })

  it("accepts a fully evidenced completion closeout", () => {
    expect(validateWorkOrderCloseout({
      resolutionNotes: "Replaced power supply and verified operation.",
      timeEntryCount: 1,
      signatureReason: "Completed after repair verification",
      reauthVerified: true,
    })).toEqual({ valid: true })
  })

  it("rejects completion closeout when required evidence is missing", () => {
    const result = validateWorkOrderCloseout({
      resolutionNotes: "",
      timeEntryCount: 0,
      signatureReason: "",
      reauthVerified: false,
    })

    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.messages).toEqual([
        "Resolution notes are required before completion.",
        "At least one job-card time entry is required before completion.",
        "Re-authentication is required before completion.",
        "A signature reason is required before completion.",
      ])
    }
  })

  it("reports closeout requirement status for the UI checklist", () => {
    expect(getWorkOrderCloseoutRequirements({
      resolutionNotes: "Verified.",
      timeEntryCount: 0,
      signatureReason: "Closeout approval",
      reauthVerified: false,
    })).toEqual([
      expect.objectContaining({ id: "resolution_notes", met: true }),
      expect.objectContaining({ id: "time_entry", met: false }),
      expect.objectContaining({ id: "reauth", met: false }),
      expect.objectContaining({ id: "signature_reason", met: true }),
    ])
  })
})
