import { createClient } from "@/lib/supabase/server"
import {
  calculateReportingDashboard,
  type ReportingDashboard,
  type ReportingFilters,
  type ReportingInput,
  type ReportEquipment,
  type ReportJobCard,
  type ReportInventoryValue,
  type ReportLowStock,
  type ReportPartUsage,
  type ReportPmOccurrence,
  type ReportPmSchedule,
  type ReportWorkOrder,
} from "@/lib/reports/calculations"

export interface ReportingFilterOptions {
  departments: string[]
  categories: string[]
  technicians: { id: string; name: string }[]
  priorities: string[]
  vendors: string[]
  sites: string[]
}

function startOfMonthIso() {
  const date = new Date()
  date.setDate(1)
  date.setHours(0, 0, 0, 0)
  return date.toISOString()
}

export function normalizeReportingFilters(filters: ReportingFilters): ReportingInput["filters"] {
  const from = filters.from ? new Date(filters.from) : new Date(startOfMonthIso())
  const to = filters.to ? new Date(filters.to) : new Date()
  from.setHours(0, 0, 0, 0)
  to.setHours(23, 59, 59, 999)

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    department: filters.department || undefined,
    category: filters.category || undefined,
    technician: filters.technician || undefined,
    priority: filters.priority || undefined,
    vendor: filters.vendor || undefined,
    site: filters.site || undefined,
  }
}

function uniq(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b))
}

function filterEquipment(equipment: ReportEquipment[], filters: ReportingInput["filters"]) {
  return equipment.filter((eq) => {
    if (filters.department && eq.department !== filters.department) return false
    if (filters.category && eq.category !== filters.category) return false
    if (filters.vendor && eq.manufacturer !== filters.vendor) return false
    if (filters.site && eq.location !== filters.site) return false
    return true
  })
}

function filterWorkOrders(workOrders: ReportWorkOrder[], equipmentIds: Set<string>, filters: ReportingInput["filters"]) {
  return workOrders.filter((wo) => {
    if (!equipmentIds.has(wo.equipment_id)) return false
    if (filters.priority && wo.priority !== filters.priority) return false
    if (filters.technician && wo.assigned_to !== filters.technician) return false
    return true
  })
}

function filterJobCards(jobCards: ReportJobCard[], workOrderIds: Set<string>, filters: ReportingInput["filters"]) {
  return jobCards.filter((card) => {
    if (!workOrderIds.has(card.work_order_id)) return false
    if (filters.technician && card.technician_id !== filters.technician) return false
    return true
  })
}

export async function getReportingFilterOptions(): Promise<ReportingFilterOptions> {
  const supabase = await createClient()
  const [{ data: equipment }, { data: technicians }] = await Promise.all([
    supabase
      .schema("ebiomed")
      .from("equipment")
      .select("department, category, manufacturer, location")
      .is("deleted_at", null),
    supabase
      .schema("ebiomed")
      .from("profiles")
      .select("id, full_name")
      .in("role", ["admin", "technician"])
      .order("full_name", { ascending: true }),
  ])

  return {
    departments: uniq((equipment || []).map((eq) => eq.department)),
    categories: uniq((equipment || []).map((eq) => eq.category)),
    technicians: (technicians || []).map((tech) => ({ id: tech.id, name: tech.full_name })),
    priorities: ["low", "medium", "high", "critical"],
    vendors: uniq((equipment || []).map((eq) => eq.manufacturer)),
    sites: uniq((equipment || []).map((eq) => eq.location)),
  }
}

export async function getReportingDashboard(filters: ReportingFilters = {}): Promise<ReportingDashboard> {
  const supabase = await createClient()
  const normalized = normalizeReportingFilters(filters)

  const [
    { data: equipmentRows },
    { data: workOrderRows },
    { data: pmRows },
    { data: pmOccurrenceRows },
    { data: jobCardRows },
    { data: inventoryValueRows },
    { data: lowStockRows },
    { data: reorderRows },
    { data: usageRows },
  ] = await Promise.all([
    supabase
      .schema("ebiomed")
      .from("equipment")
      .select("id, name, tag_number, department, category, manufacturer, location, acquisition_date, install_date, warranty_expiry, support_expiry, purchase_cost, expected_life_years, residual_value, current_value, depreciation_method, replacement_target_date, lifecycle_stage, patient_impact, downtime_impact, utilization, regulatory_class, maintenance_burden")
      .is("deleted_at", null),
    supabase
      .schema("ebiomed")
      .from("work_orders")
      .select("id, equipment_id, type, priority, status, assigned_to, created_at, started_at, completed_at, downtime_minutes, description, resolution_notes, equipment:equipment_id(id, name, tag_number, department, category, manufacturer, location, acquisition_date, install_date, warranty_expiry, support_expiry, purchase_cost, expected_life_years, residual_value, current_value, depreciation_method, replacement_target_date, lifecycle_stage, patient_impact, downtime_impact, utilization, regulatory_class, maintenance_burden)")
      .is("deleted_at", null)
      .gte("created_at", normalized.from)
      .lte("created_at", normalized.to),
    supabase
      .schema("ebiomed")
      .from("pm_schedules")
      .select("id, equipment_id, description, next_due, last_completed, assigned_to, active, equipment:equipment_id(id, name, tag_number, department, category, manufacturer, location, acquisition_date, install_date, warranty_expiry, support_expiry, purchase_cost, expected_life_years, residual_value, current_value, depreciation_method, replacement_target_date, lifecycle_stage, patient_impact, downtime_impact, utilization, regulatory_class, maintenance_burden)")
      .eq("active", true)
      .lte("next_due", normalized.to),
    supabase
      .schema("ebiomed")
      .from("pm_occurrences")
      .select("id, pm_schedule_id, equipment_id, due_at, status, completed_at, missed_at, work_order_id, escalation_level, schedule:pm_schedule_id(id, equipment_id, description, next_due, last_completed, assigned_to, active), equipment:equipment_id(id, name, tag_number, department, category, manufacturer, location, acquisition_date, install_date, warranty_expiry, support_expiry, purchase_cost, expected_life_years, residual_value, current_value, depreciation_method, replacement_target_date, lifecycle_stage, patient_impact, downtime_impact, utilization, regulatory_class, maintenance_burden)")
      .gte("due_at", normalized.from)
      .lte("due_at", normalized.to),
    supabase
      .schema("ebiomed")
      .from("job_cards")
      .select("id, work_order_id, technician_id, status, started_at, completed_at, technician:technician_id(id, full_name, department), work_order:work_order_id(id, equipment_id, type, priority, status, assigned_to, created_at, started_at, completed_at, downtime_minutes, description, resolution_notes, equipment:equipment_id(id, name, tag_number, department, category, manufacturer, location, acquisition_date, install_date, warranty_expiry, support_expiry, purchase_cost, expected_life_years, residual_value, current_value, depreciation_method, replacement_target_date, lifecycle_stage, patient_impact, downtime_impact, utilization, regulatory_class, maintenance_burden)), entries:job_card_entries(id, job_card_id, duration_minutes, started_at, ended_at), expenses:job_card_expenses(id, job_card_id, category, amount, description), parts:job_card_parts(id, job_card_id, quantity_used, part:part_id(name, unit_cost, supplier))")
      .gte("started_at", normalized.from)
      .lte("started_at", normalized.to),
    supabase.schema("ebiomed").from("inventory_value_report").select("*"),
    supabase.schema("ebiomed").from("low_stock_report").select("*"),
    supabase.schema("ebiomed").from("reorder_suggestions").select("*"),
    supabase
      .schema("ebiomed")
      .from("parts_usage_report")
      .select("*")
      .gte("recorded_at", normalized.from)
      .lte("recorded_at", normalized.to),
  ])

  const equipment = (equipmentRows || []) as ReportEquipment[]
  const scopedEquipment = filterEquipment(equipment, normalized)
  const equipmentIds = new Set(scopedEquipment.map((eq) => eq.id))
  const scopedWorkOrders = filterWorkOrders((workOrderRows || []) as unknown as ReportWorkOrder[], equipmentIds, normalized)
  const workOrderIds = new Set(scopedWorkOrders.map((wo) => wo.id))
  const scopedPm = ((pmRows || []) as unknown as ReportPmSchedule[]).filter((pm) => equipmentIds.has(pm.equipment_id))
  const scopedPmOccurrences = ((pmOccurrenceRows || []) as unknown as ReportPmOccurrence[]).filter((occurrence) =>
    equipmentIds.has(occurrence.equipment_id)
  )
  const scopedJobCards = filterJobCards((jobCardRows || []) as unknown as ReportJobCard[], workOrderIds, normalized)
  const scopedUsage = ((usageRows || []) as unknown as ReportPartUsage[]).filter((usage) =>
    !usage.equipment_id || equipmentIds.has(usage.equipment_id)
  )

  return calculateReportingDashboard({
    filters: normalized,
    equipment: scopedEquipment,
    workOrders: scopedWorkOrders,
    pmSchedules: scopedPm,
    pmOccurrences: scopedPmOccurrences,
    jobCards: scopedJobCards,
    inventoryValue: (inventoryValueRows || []) as unknown as ReportInventoryValue[],
    lowStock: (lowStockRows || []) as unknown as ReportLowStock[],
    reorderSuggestions: (reorderRows || []) as unknown as ReportLowStock[],
    partsUsage: scopedUsage,
  })
}
