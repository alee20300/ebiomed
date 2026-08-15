import { describe, expect, it } from "vitest"
import { buildTelemetryUpdates } from "@/lib/utils/telemetry"

describe("buildTelemetryUpdates", () => {
  it("only writes real equipment telemetry columns", () => {
    const updates = buildTelemetryUpdates({
      equipment_id: "asset-1",
      run_hours: "42.5",
      cycle_count: "12",
      // temperature_celsius is intentionally ignored until a real column exists.
      temperature_celsius: "22",
    } as Record<string, unknown>, "2026-06-05T00:00:00.000Z")

    expect(updates).toEqual({
      updated_at: "2026-06-05T00:00:00.000Z",
      run_hours: 42.5,
      cycle_count: 12,
    })
    expect(updates).not.toHaveProperty("last_telemetry_temp")
  })

  it("rejects invalid and negative counter values by omitting them", () => {
    const updates = buildTelemetryUpdates({
      run_hours: -1,
      cycle_count: 1.5,
    }, "2026-06-05T00:00:00.000Z")

    expect(updates).toEqual({ updated_at: "2026-06-05T00:00:00.000Z" })
  })
})
