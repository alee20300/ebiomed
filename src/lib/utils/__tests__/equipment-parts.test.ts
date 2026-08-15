import { describe, expect, it } from "vitest"
import { compatibilityRuleMatchesEquipment } from "@/lib/utils/equipment-parts"

const equipment = {
  manufacturer: "Drager",
  model: "V500",
  device_category: "Ventilator",
  category: "Respiratory",
}

describe("spare-part compatibility inheritance", () => {
  it("matches the same manufacturer and model case-insensitively", () => {
    expect(compatibilityRuleMatchesEquipment({
      scope_type: "model",
      manufacturer: " drager ",
      model: "v500",
      device_category: null,
    }, equipment)).toBe(true)
  })

  it("does not inherit a model rule to a different model", () => {
    expect(compatibilityRuleMatchesEquipment({
      scope_type: "model",
      manufacturer: "Drager",
      model: "V600",
      device_category: null,
    }, equipment)).toBe(false)
  })

  it("supports manufacturer, category, and universal scopes", () => {
    expect(compatibilityRuleMatchesEquipment({ scope_type: "manufacturer", manufacturer: "Drager", model: null, device_category: null }, equipment)).toBe(true)
    expect(compatibilityRuleMatchesEquipment({ scope_type: "category", manufacturer: null, model: null, device_category: "Ventilator" }, equipment)).toBe(true)
    expect(compatibilityRuleMatchesEquipment({ scope_type: "universal", manufacturer: null, model: null, device_category: null }, equipment)).toBe(true)
  })
})
