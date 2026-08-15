export type CompatibilityScope = "equipment" | "model" | "manufacturer" | "category" | "universal"

export interface EquipmentCompatibilityProfile {
  manufacturer: string | null
  model: string | null
  device_category: string | null
  category: string | null
}

export interface CompatibilityRuleProfile {
  scope_type: Exclude<CompatibilityScope, "equipment">
  manufacturer: string | null
  model: string | null
  device_category: string | null
}

function normalized(value: string | null | undefined) {
  return value?.trim().toLocaleLowerCase() || ""
}

export function compatibilityRuleMatchesEquipment(
  rule: CompatibilityRuleProfile,
  equipment: EquipmentCompatibilityProfile
) {
  if (rule.scope_type === "universal") return true
  if (rule.scope_type === "model") {
    return normalized(rule.manufacturer) === normalized(equipment.manufacturer) && normalized(rule.model) === normalized(equipment.model)
  }
  if (rule.scope_type === "manufacturer") return normalized(rule.manufacturer) === normalized(equipment.manufacturer)
  return normalized(rule.device_category) === normalized(equipment.device_category || equipment.category)
}

export function compatibilityScopeLabel(
  scope: CompatibilityScope | "historical",
  equipment: EquipmentCompatibilityProfile
) {
  if (scope === "equipment") return "This equipment only"
  if (scope === "model") return `All ${equipment.manufacturer || "matching"} ${equipment.model || "model"}`
  if (scope === "manufacturer") return `All ${equipment.manufacturer || "matching manufacturer"} equipment`
  if (scope === "category") return `Category: ${equipment.device_category || equipment.category || "matching category"}`
  if (scope === "universal") return "Universal compatibility"
  return "Used historically"
}
