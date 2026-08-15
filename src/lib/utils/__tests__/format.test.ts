import { describe, it, expect } from "vitest"
import {
  formatDateTime,
  formatDate,
  statusColor,
  priorityColor,
  statusTone,
  priorityTone,
} from "@/lib/utils/format"

describe("statusTone", () => {
  it("maps healthy terminal states to success", () => {
    expect(statusTone("active")).toBe("success")
    expect(statusTone("completed")).toBe("success")
    expect(statusTone("approved")).toBe("success")
    expect(statusTone("certified")).toBe("success")
  })

  it("maps in-flight and attention states to warning", () => {
    expect(statusTone("in_progress")).toBe("warning")
    expect(statusTone("on_hold")).toBe("warning")
    expect(statusTone("under_repair")).toBe("warning")
    expect(statusTone("pending_review")).toBe("warning")
  })

  it("maps failure states to danger", () => {
    expect(statusTone("out_of_tolerance")).toBe("danger")
    expect(statusTone("rejected")).toBe("danger")
    expect(statusTone("retired")).toBe("danger")
  })

  it("maps informational states to info", () => {
    expect(statusTone("open")).toBe("info")
    expect(statusTone("triaged")).toBe("info")
    expect(statusTone("converted")).toBe("info")
  })

  it("falls back to neutral for unknown status", () => {
    expect(statusTone("nonexistent")).toBe("neutral")
    expect(statusTone("cancelled")).toBe("neutral")
  })
})

describe("statusColor", () => {
  it("resolves a tone to token-backed classes", () => {
    expect(statusColor("completed")).toBe("bg-success-subtle text-success-strong")
    expect(statusColor("nonexistent")).toBe("bg-neutral-subtle text-neutral-strong")
  })

  it("never emits raw palette classes", () => {
    for (const status of ["open", "in_progress", "retired", "certified", "whatever"]) {
      expect(statusColor(status)).not.toMatch(/-\d{2,3}\b/)
    }
  })
})

describe("priorityTone", () => {
  it("escalates low → critical across the tone scale", () => {
    expect(priorityTone("low")).toBe("neutral")
    expect(priorityTone("medium")).toBe("info")
    expect(priorityTone("high")).toBe("warning")
    expect(priorityTone("critical")).toBe("danger")
  })

  it("falls back to neutral for unknown priority", () => {
    expect(priorityTone("nonexistent")).toBe("neutral")
  })
})

describe("priorityColor", () => {
  it("resolves a tone to token-backed classes", () => {
    expect(priorityColor("critical")).toBe("bg-danger-subtle text-danger-strong")
  })
})

describe("formatDate", () => {
  it("formats date string", () => {
    const result = formatDate("2024-01-15")
    expect(result).toContain("15")
    expect(result).toContain("2024")
  })

  it("returns '—' for null", () => {
    expect(formatDate(null)).toBe("—")
  })
})
