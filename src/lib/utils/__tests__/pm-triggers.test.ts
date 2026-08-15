import { describe, expect, it } from "vitest"
import {
  buildUsagePMDescription,
  getUsagePMResetFields,
  shouldTriggerUsagePM,
  type PMTriggerEquipment,
} from "@/lib/utils/pm-triggers"

const baseEquipment: PMTriggerEquipment = {
  name: "Infusion Pump",
  tag_number: "BM-100",
  run_hours: 0,
  cycle_count: 0,
  pm_trigger_type: "calendar",
  pm_trigger_value: 100,
}

describe("usage-based PM triggers", () => {
  it("triggers on run hours when threshold is reached", () => {
    expect(shouldTriggerUsagePM({ ...baseEquipment, pm_trigger_type: "run_hours", run_hours: 100 })).toBe(true)
    expect(shouldTriggerUsagePM({ ...baseEquipment, pm_trigger_type: "run_hours", run_hours: 99 })).toBe(false)
  })

  it("triggers on cycles when threshold is reached", () => {
    expect(shouldTriggerUsagePM({ ...baseEquipment, pm_trigger_type: "cycles", cycle_count: 100 })).toBe(true)
    expect(shouldTriggerUsagePM({ ...baseEquipment, pm_trigger_type: "cycles", cycle_count: 99 })).toBe(false)
  })

  it("supports combined calendar-or-usage and calendar-and-usage trigger logic", () => {
    expect(shouldTriggerUsagePM({ ...baseEquipment, pm_trigger_type: "calendar_or_usage", run_hours: 100, cycle_count: 0 })).toBe(true)
    expect(shouldTriggerUsagePM({ ...baseEquipment, pm_trigger_type: "calendar_and_usage", run_hours: 100, cycle_count: 0 })).toBe(false)
    expect(shouldTriggerUsagePM({ ...baseEquipment, pm_trigger_type: "calendar_and_usage", run_hours: 100, cycle_count: 100 })).toBe(true)
  })

  it("resets the counters used by each trigger type", () => {
    expect(getUsagePMResetFields("run_hours")).toEqual({ run_hours: 0 })
    expect(getUsagePMResetFields("cycles")).toEqual({ cycle_count: 0 })
    expect(getUsagePMResetFields("calendar_or_usage")).toEqual({ run_hours: 0, cycle_count: 0 })
    expect(getUsagePMResetFields("calendar")).toEqual({})
  })

  it("builds a field-ready description for generated PM work orders", () => {
    expect(buildUsagePMDescription({ ...baseEquipment, pm_trigger_type: "run_hours", run_hours: 125 })).toContain("125 run hours")
    expect(buildUsagePMDescription({ ...baseEquipment, pm_trigger_type: "cycles", cycle_count: 140 })).toContain("140 cycles")
  })
})
