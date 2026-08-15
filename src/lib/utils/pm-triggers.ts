export type PMTriggerType = "calendar" | "run_hours" | "cycles" | "calendar_or_usage" | "calendar_and_usage"

export interface PMTriggerEquipment {
  name: string
  tag_number: string
  run_hours: number | null
  cycle_count: number | null
  pm_trigger_type: PMTriggerType
  pm_trigger_value: number | null
}

function meetsThreshold(value: number | null, threshold: number | null): boolean {
  return value !== null && threshold !== null && value >= threshold
}

export function shouldTriggerUsagePM(equipment: PMTriggerEquipment): boolean {
  const runHoursDue = meetsThreshold(equipment.run_hours, equipment.pm_trigger_value)
  const cyclesDue = meetsThreshold(equipment.cycle_count, equipment.pm_trigger_value)

  switch (equipment.pm_trigger_type) {
    case "run_hours":
      return runHoursDue
    case "cycles":
      return cyclesDue
    case "calendar_or_usage":
      return runHoursDue || cyclesDue
    case "calendar_and_usage":
      return runHoursDue && cyclesDue
    default:
      return false
  }
}

export function getUsagePMResetFields(triggerType: PMTriggerType): Record<string, number> {
  if (triggerType === "run_hours") return { run_hours: 0 }
  if (triggerType === "cycles") return { cycle_count: 0 }
  if (triggerType === "calendar_or_usage" || triggerType === "calendar_and_usage") {
    return { run_hours: 0, cycle_count: 0 }
  }
  return {}
}

export function buildUsagePMDescription(equipment: PMTriggerEquipment): string {
  const threshold = equipment.pm_trigger_value
  if (equipment.pm_trigger_type === "run_hours") {
    return `Usage-based PM triggered: ${equipment.run_hours} run hours reached (threshold: ${threshold}). Equipment: ${equipment.name} (${equipment.tag_number}).`
  }
  if (equipment.pm_trigger_type === "cycles") {
    return `Usage-based PM triggered: ${equipment.cycle_count} cycles reached (threshold: ${threshold}). Equipment: ${equipment.name} (${equipment.tag_number}).`
  }
  return `Usage-based PM triggered: run_hours=${equipment.run_hours}, cycles=${equipment.cycle_count}. Equipment: ${equipment.name} (${equipment.tag_number}).`
}
