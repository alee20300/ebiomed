import { describe, expect, it } from "vitest"
import {
  buildEscalationNotification,
  getEscalationLevel,
  getNextDueAfterCompletion,
  getOccurrenceStatusAfterGrace,
  shouldCreateOccurrence,
  shouldGenerateWorkOrder,
  validateEscalationPolicy,
  type PMEngineSchedule,
} from "@/lib/pm/engine"

const baseSchedule: PMEngineSchedule = {
  id: "pm-1",
  equipment_id: "asset-1",
  description: "Ventilator PM",
  assigned_to: "tech-1",
  trigger_type: "calendar",
  calendar_interval_days: 30,
  meter_interval: null,
  cycle_interval: null,
  risk_modifier: 1,
  grace_period_days: 2,
  active: true,
  next_due: "2026-01-01T00:00:00.000Z",
  last_completed: null,
  equipment: {
    name: "Ventilator",
    tag_number: "V-1",
    department: "ICU",
    run_hours: 0,
    cycle_count: 0,
  },
}

describe("advanced PM engine", () => {
  it("creates due calendar occurrences", () => {
    expect(shouldCreateOccurrence(baseSchedule, undefined, "2026-01-02T00:00:00.000Z")).toMatchObject({
      pm_schedule_id: "pm-1",
      due_at: "2026-01-01T00:00:00.000Z",
      trigger_type: "calendar",
    })
  })

  it("creates meter and cycle occurrences", () => {
    expect(shouldCreateOccurrence({
      ...baseSchedule,
      trigger_type: "run_hours",
      meter_interval: 100,
      next_due: null,
      equipment: { ...baseSchedule.equipment!, run_hours: 120 },
    }, undefined, "2026-01-02T00:00:00.000Z")).toMatchObject({ due_meter: 100 })

    expect(shouldCreateOccurrence({
      ...baseSchedule,
      trigger_type: "cycles",
      cycle_interval: 50,
      next_due: null,
      equipment: { ...baseSchedule.equipment!, cycle_count: 55 },
    }, undefined, "2026-01-02T00:00:00.000Z")).toMatchObject({ due_cycle: 50 })
  })

  it("prevents duplicate open occurrences and duplicate generated work orders", () => {
    const occurrence = {
      id: "occ-1",
      pm_schedule_id: "pm-1",
      equipment_id: "asset-1",
      due_at: "2026-01-01T00:00:00.000Z",
      trigger_type: "calendar" as const,
      due_meter: null,
      due_cycle: null,
      status: "due" as const,
      work_order_id: null,
      escalation_level: "none" as const,
    }

    expect(shouldCreateOccurrence(baseSchedule, occurrence, "2026-01-02T00:00:00.000Z")).toBeNull()
    expect(shouldGenerateWorkOrder(occurrence, false)).toBe(true)
    expect(shouldGenerateWorkOrder(occurrence, true)).toBe(false)
    expect(shouldGenerateWorkOrder({ ...occurrence, work_order_id: "wo-1" }, false)).toBe(false)
  })

  it("marks missed after grace and escalates by policy", () => {
    const occurrence = {
      status: "generated" as const,
      due_at: "2026-01-01T00:00:00.000Z",
      escalation_level: "none" as const,
    }

    expect(getOccurrenceStatusAfterGrace(occurrence, 2, "2026-01-04T00:00:00.000Z")).toBe("missed")
    expect(getEscalationLevel(occurrence, {
      assignee_after_days: 0,
      admin_after_days: 2,
      department_after_days: 5,
    }, "2026-01-04T00:00:00.000Z")).toBe("admin")
  })

  it("builds assignee and department escalation notification evidence", () => {
    const occurrence = {
      id: "occ-1",
      pm_schedule_id: "pm-1",
      equipment_id: "asset-1",
      due_at: "2026-01-01T00:00:00.000Z",
    }

    expect(buildEscalationNotification(occurrence, baseSchedule, "assignee", "2026-01-02T00:00:00.000Z")).toMatchObject({
      pm_occurrence_id: "occ-1",
      recipient_type: "assignee",
      recipient_user_id: "tech-1",
      recipient_department: null,
    })
    expect(buildEscalationNotification(occurrence, baseSchedule, "department", "2026-01-06T00:00:00.000Z")).toMatchObject({
      pm_occurrence_id: "occ-1",
      recipient_type: "department",
      recipient_user_id: null,
      recipient_department: "ICU",
    })
  })

  it("advances next calendar due from completion with risk modifier", () => {
    expect(getNextDueAfterCompletion({
      ...baseSchedule,
      calendar_interval_days: 30,
      risk_modifier: 0.5,
    }, "2026-01-10T00:00:00.000Z")).toBe("2026-01-25T00:00:00.000Z")
  })

  it("validates escalation policy order", () => {
    expect(validateEscalationPolicy({
      assignee_after_days: 0,
      admin_after_days: 2,
      department_after_days: 5,
    })).toEqual([])
    expect(validateEscalationPolicy({
      assignee_after_days: 3,
      admin_after_days: 2,
      department_after_days: 5,
    })).toContain("Assignee escalation must happen before admin escalation")
  })
})
