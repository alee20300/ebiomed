import { describe, expect, it } from "vitest"
import { parseCsv, validateImportRows } from "@/lib/imports/validation"

describe("import validation", () => {
  it("parses quoted CSV values", () => {
    expect(parseCsv('name,notes\n"Infusion Pump","Line 1, ICU"')).toEqual([
      ["name", "notes"],
      ["Infusion Pump", "Line 1, ICU"],
    ])
  })

  it("rejects invalid parts numeric fields before commit", () => {
    const result = validateImportRows(
      "parts",
      "name,part_number,quantity_on_hand,min_threshold,max_threshold,reorder_quantity,unit_cost,supplier,stock_location,bin_code\nBattery,BAT-1,-1,abc,,2.5,-10,,,",
    )

    expect(result.validRows).toBe(0)
    expect(result.errors).toEqual(expect.arrayContaining([
      { row: 2, field: "quantity_on_hand", message: "quantity_on_hand must be at least 0" },
      { row: 2, field: "min_threshold", message: "min_threshold must be a number" },
      { row: 2, field: "reorder_quantity", message: "reorder_quantity must be a whole number" },
      { row: 2, field: "unit_cost", message: "unit_cost must be at least 0" },
    ]))
  })

  it("detects invalid PM schedule cadence and dates", () => {
    const result = validateImportRows(
      "pms",
      "equipment_tag,frequency_days,description,assigned_to_email,next_due\nBM-1,0,Annual,,not-a-date",
    )

    expect(result.validRows).toBe(0)
    expect(result.errors).toEqual(expect.arrayContaining([
      { row: 2, field: "frequency_days", message: "frequency_days must be at least 1" },
      { row: 2, field: "next_due", message: "next_due must be a valid date" },
    ]))
  })
})
