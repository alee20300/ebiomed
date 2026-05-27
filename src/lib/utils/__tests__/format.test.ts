import { describe, it, expect } from "vitest"
import { formatDateTime, formatDate, statusColor, priorityColor } from "@/lib/utils/format"

describe("statusColor", () => {
  it("returns green for active", () => {
    expect(statusColor("active")).toBe("bg-green-100 text-green-800")
  })

  it("returns green for completed", () => {
    expect(statusColor("completed")).toBe("bg-green-100 text-green-800")
  })

  it("returns purple for under_repair", () => {
    expect(statusColor("under_repair")).toBe("bg-purple-100 text-purple-800")
  })

  it("returns red for out_of_tolerance", () => {
    expect(statusColor("out_of_tolerance")).toBe("bg-red-100 text-red-800")
  })

  it("returns emerald for certified", () => {
    expect(statusColor("certified")).toBe("bg-emerald-100 text-emerald-800")
  })

  it("returns gray for unknown status", () => {
    expect(statusColor("nonexistent")).toBe("bg-gray-100 text-gray-800")
  })

  it("returns yellow for in_progress", () => {
    expect(statusColor("in_progress")).toBe("bg-yellow-100 text-yellow-800")
  })
})

describe("priorityColor", () => {
  it("returns gray for low", () => {
    expect(priorityColor("low")).toBe("bg-gray-100 text-gray-700")
  })

  it("returns blue for medium", () => {
    expect(priorityColor("medium")).toBe("bg-blue-100 text-blue-700")
  })

  it("returns orange for high", () => {
    expect(priorityColor("high")).toBe("bg-orange-100 text-orange-700")
  })

  it("returns red for critical", () => {
    expect(priorityColor("critical")).toBe("bg-red-100 text-red-700")
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
