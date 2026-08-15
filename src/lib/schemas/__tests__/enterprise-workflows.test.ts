import { describe, expect, it } from "vitest"
import { calibrationInvestigationSchema } from "@/lib/schemas/calibration"
import { partSchema } from "@/lib/schemas/parts"
import { purchaseRequestSchema } from "@/lib/schemas/purchasing"
import { workOrderUpdateSchema } from "@/lib/schemas/work-order"

const uuid = "11111111-1111-4111-8111-111111111111"

describe("enterprise workflow controls", () => {
  it("requires root cause and outcome before work order closeout", () => {
    expect(workOrderUpdateSchema.safeParse({
      status: "completed",
      resolution_notes: "Work completed",
      reason: "Closing completed work order",
    }).success).toBe(false)

    expect(workOrderUpdateSchema.safeParse({
      status: "completed",
      root_cause: "Worn battery",
      service_outcome: "repaired",
      resolution_notes: "Battery replaced and tested",
      reason: "Closing completed work order",
    }).success).toBe(true)
  })

  it("requires corrective action to complete calibration investigation", () => {
    expect(calibrationInvestigationSchema.safeParse({
      reading_id: uuid,
      equipment_id: uuid,
      investigation_status: "completed",
      investigation_notes: "Reading failed tolerance check",
      reason: "Closing investigation",
    }).success).toBe(false)

    expect(calibrationInvestigationSchema.safeParse({
      reading_id: uuid,
      equipment_id: uuid,
      investigation_status: "completed",
      investigation_notes: "Reading failed tolerance check",
      corrective_action: "Adjusted pump and repeated calibration",
      reason: "Closing investigation",
    }).success).toBe(true)
  })

  it("requires quarantine reason when part stock is not released", () => {
    expect(partSchema.safeParse({
      name: "Battery",
      quantity_on_hand: 2,
      quarantine_status: "recalled",
    }).success).toBe(false)

    expect(partSchema.safeParse({
      name: "Battery",
      quantity_on_hand: 2,
      quarantine_status: "recalled",
      quarantine_reason: "Manufacturer recall",
    }).success).toBe(true)
  })

  it("accepts explicit purchase approval levels", () => {
    expect(purchaseRequestSchema.safeParse({
      part_id: uuid,
      requested_quantity: 5,
      estimated_unit_cost: 1000,
      approval_level: "finance",
      reason: "Critical stock replenishment",
    }).success).toBe(true)
  })
})
