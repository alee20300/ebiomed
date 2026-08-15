export interface TelemetryBody {
  equipment_id?: unknown
  run_hours?: unknown
  cycle_count?: unknown
}

export function buildTelemetryUpdates(body: TelemetryBody, nowIso: string): Record<string, unknown> {
  const updates: Record<string, unknown> = { updated_at: nowIso }

  if (body.run_hours !== undefined) {
    const runHours = Number(body.run_hours)
    if (Number.isFinite(runHours) && runHours >= 0) {
      updates.run_hours = runHours
    }
  }

  if (body.cycle_count !== undefined) {
    const cycleCount = Number(body.cycle_count)
    if (Number.isInteger(cycleCount) && cycleCount >= 0) {
      updates.cycle_count = cycleCount
    }
  }

  return updates
}
