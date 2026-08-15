export type ImportTemplate = "equipment" | "users" | "parts" | "pms" | "vendors"

export const IMPORT_TEMPLATES: Record<ImportTemplate, string[]> = {
  equipment: ["tag_number", "name", "serial_number", "model", "manufacturer", "department", "location", "status"],
  users: ["email", "full_name", "role", "department", "phone"],
  parts: ["name", "part_number", "quantity_on_hand", "min_threshold", "max_threshold", "reorder_quantity", "unit_cost", "supplier", "stock_location", "bin_code"],
  pms: ["equipment_tag", "frequency_days", "description", "assigned_to_email", "next_due"],
  vendors: ["name", "contact_name", "email", "phone", "address", "notes"],
}
