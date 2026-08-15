import { KPI_DEFINITIONS, type KpiDefinition, type ReportId, SLA_TARGET_HOURS } from "@/lib/reports/definitions"
import { calculateRiskScore, getAssetAgeYears, getReplacementRecommendation, getUsefulLifeEndDate } from "@/lib/utils/asset-lifecycle"

export interface ReportingFilters {
  from?: string
  to?: string
  department?: string
  category?: string
  technician?: string
  priority?: string
  vendor?: string
  site?: string
}

export interface ReportEquipment {
  id: string
  name: string
  tag_number: string
  department: string | null
  category: string | null
  manufacturer: string | null
  location: string | null
  acquisition_date?: string | null
  install_date?: string | null
  warranty_expiry?: string | null
  support_expiry?: string | null
  purchase_cost?: number | null
  expected_life_years?: number | null
  residual_value?: number | null
  current_value?: number | null
  depreciation_method?: "straight_line" | "declining_balance" | "none"
  replacement_target_date?: string | null
  lifecycle_stage?: "planning" | "procurement" | "commissioning" | "in_service" | "limited_support" | "end_of_life" | "retired"
  patient_impact?: number
  downtime_impact?: number
  utilization?: number
  regulatory_class?: number
  maintenance_burden?: number
}

export interface ReportWorkOrder {
  id: string
  equipment_id: string
  type: "corrective" | "preventive"
  priority: "low" | "medium" | "high" | "critical"
  status: "open" | "in_progress" | "on_hold" | "completed" | "cancelled"
  assigned_to: string | null
  created_at: string
  started_at: string | null
  completed_at: string | null
  downtime_minutes: number | null
  description?: string | null
  resolution_notes?: string | null
  equipment?: ReportEquipment | null
}

export interface ReportPmSchedule {
  id: string
  equipment_id: string
  description: string | null
  next_due: string | null
  last_completed: string | null
  assigned_to: string | null
  active: boolean
  equipment?: ReportEquipment | null
}

export interface ReportPmOccurrence {
  id: string
  pm_schedule_id: string
  equipment_id: string
  due_at: string
  status: "due" | "generated" | "completed" | "missed" | "skipped"
  completed_at: string | null
  missed_at: string | null
  work_order_id: string | null
  escalation_level?: "none" | "assignee" | "admin" | "department"
  schedule?: ReportPmSchedule | null
  equipment?: ReportEquipment | null
}

export interface ReportTechnician {
  id: string
  full_name: string
  department: string | null
}

export interface ReportJobCardEntry {
  id: string
  job_card_id: string
  duration_minutes: number
  started_at: string
  ended_at: string
}

export interface ReportJobCardExpense {
  id: string
  job_card_id: string
  category: string
  amount: number
  description: string
}

export interface ReportJobCardPart {
  id: string
  job_card_id: string
  quantity_used: number
  part?: { name: string; unit_cost: number | null; supplier: string | null } | null
}

export interface ReportJobCard {
  id: string
  work_order_id: string
  technician_id: string
  status: "in_progress" | "completed"
  started_at: string
  completed_at: string | null
  technician?: ReportTechnician | null
  work_order?: ReportWorkOrder | null
  entries?: ReportJobCardEntry[]
  expenses?: ReportJobCardExpense[]
  parts?: ReportJobCardPart[]
}

export interface ReportInventoryValue {
  part_id: string
  name: string
  part_number: string | null
  stock_location: string
  bin_code: string | null
  quantity_on_hand: number
  unit_cost: number
  inventory_value: number
  valuation_method: string
}

export interface ReportLowStock {
  part_id: string
  name: string
  part_number: string | null
  stock_location: string
  bin_code: string | null
  quantity_on_hand: number
  min_threshold: number
  max_threshold: number | null
  reorder_quantity: number
  vendor_name?: string | null
  estimated_cost?: number | null
}

export interface ReportPartUsage {
  transaction_id: string
  part_id: string
  part_name: string
  part_number: string | null
  quantity_used: number
  unit_cost: number
  usage_cost: number
  work_order_id: string | null
  equipment_id: string | null
  equipment_name: string | null
  tag_number: string | null
  department: string | null
  job_card_id: string | null
  recorded_at: string
}

export interface ReportingInput {
  filters: Required<Pick<ReportingFilters, "from" | "to">> & ReportingFilters
  equipment: ReportEquipment[]
  workOrders: ReportWorkOrder[]
  pmSchedules: ReportPmSchedule[]
  pmOccurrences?: ReportPmOccurrence[]
  jobCards: ReportJobCard[]
  inventoryValue?: ReportInventoryValue[]
  lowStock?: ReportLowStock[]
  reorderSuggestions?: ReportLowStock[]
  partsUsage?: ReportPartUsage[]
}

export interface KpiValue {
  id: string
  label: string
  value: number | string
  displayValue: string
  unit: string
  formula: string
}

export interface GroupMetric {
  label: string
  value: number
  secondary?: string
}

export interface EvidenceRow {
  id: string
  item: string
  owner: string
  status: string
  date: string
  evidence: string
}

export interface ReportingDashboard {
  filters: ReportingInput["filters"]
  definitions: KpiDefinition[]
  kpis: KpiValue[]
  reports: Record<ReportId, { title: string; rows: GroupMetric[] | EvidenceRow[] }>
  charts: {
    workOrderMix: GroupMetric[]
    pmCompliance: GroupMetric[]
    reliabilityByAsset: GroupMetric[]
    technicianWorkload: GroupMetric[]
    costByDepartment: GroupMetric[]
  }
}

function numberFormat(value: number, digits = 1) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value)
}

function moneyFormat(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value)
}

function percentFormat(value: number) {
  return `${numberFormat(value, 1)}%`
}

function hoursBetween(start: string, end: string) {
  return Math.max((new Date(end).getTime() - new Date(start).getTime()) / 3_600_000, 0)
}

function addGroup(groups: Map<string, GroupMetric>, label: string | null | undefined, amount: number, secondary?: string) {
  const key = label || "Unassigned"
  const current = groups.get(key) || { label: key, value: 0, secondary }
  current.value += amount
  if (!current.secondary && secondary) current.secondary = secondary
  groups.set(key, current)
}

function sortedGroups(groups: Map<string, GroupMetric>, limit?: number) {
  const rows = Array.from(groups.values()).sort((a, b) => b.value - a.value)
  return typeof limit === "number" ? rows.slice(0, limit) : rows
}

function definition(id: string) {
  const found = KPI_DEFINITIONS.find((item) => item.id === id)
  if (!found) throw new Error(`Missing KPI definition for ${id}`)
  return found
}

function kpi(id: string, value: number | string, displayValue: string): KpiValue {
  const def = definition(id)
  return { id, label: def.label, value, displayValue, unit: def.unit, formula: def.formula }
}

export function calculateReportingDashboard(input: ReportingInput): ReportingDashboard {
  const {
    equipment,
    workOrders,
    pmSchedules,
    pmOccurrences = [],
    jobCards,
    filters,
    inventoryValue = [],
    lowStock = [],
    reorderSuggestions = [],
    partsUsage = [],
  } = input
  const from = new Date(filters.from)
  const to = new Date(filters.to)
  const rangeHours = Math.max((to.getTime() - from.getTime()) / 3_600_000, 1)

  const completedCorrective = workOrders.filter(
    (wo) => wo.type === "corrective" && wo.status === "completed" && wo.started_at && wo.completed_at
  )
  const mttrHours = completedCorrective.length
    ? completedCorrective.reduce((sum, wo) => sum + hoursBetween(wo.started_at!, wo.completed_at!), 0) / completedCorrective.length
    : 0

  const correctiveCount = workOrders.filter((wo) => wo.type === "corrective").length
  const preventiveCount = workOrders.filter((wo) => wo.type === "preventive").length
  const downtimeHours = workOrders.reduce((sum, wo) => sum + (wo.downtime_minutes || 0), 0) / 60
  const observedHours = equipment.length * rangeHours
  const uptimePercent = observedHours > 0 ? Math.max(((observedHours - downtimeHours) / observedHours) * 100, 0) : 0
  const mtbfHours = correctiveCount > 0 ? Math.max((observedHours - downtimeHours) / correctiveCount, 0) : 0

  const occurrenceBackfill = pmOccurrences.length
    ? []
    : pmSchedules
        .filter((pm) => pm.active && pm.next_due && new Date(pm.next_due) <= to)
        .map((pm): ReportPmOccurrence => ({
          id: pm.id,
          pm_schedule_id: pm.id,
          equipment_id: pm.equipment_id,
          due_at: pm.next_due!,
          status: pm.last_completed && new Date(pm.last_completed) <= new Date(pm.next_due!) ? "completed" : "due",
          completed_at: pm.last_completed,
          missed_at: null,
          work_order_id: null,
          escalation_level: "none",
          schedule: pm,
          equipment: pm.equipment || null,
        }))
  const duePm = (pmOccurrences.length ? pmOccurrences : occurrenceBackfill).filter(
    (occurrence) => new Date(occurrence.due_at) >= from && new Date(occurrence.due_at) <= to
  )
  const completedPm = duePm.filter((occurrence) => occurrence.status === "completed" && !occurrence.missed_at)
  const overduePm = duePm.filter((occurrence) => occurrence.status === "missed" || occurrence.status === "due" || occurrence.status === "generated")
  const pmCompliance = duePm.length ? (completedPm.length / duePm.length) * 100 : 0
  const reactivePreventiveRatio = preventiveCount > 0 ? correctiveCount / preventiveCount : correctiveCount

  const completedOrders = workOrders.filter((wo) => wo.status === "completed" && wo.completed_at)
  const withinSla = completedOrders.filter((wo) => {
    const target = SLA_TARGET_HOURS[wo.priority] || SLA_TARGET_HOURS.medium
    return hoursBetween(wo.created_at, wo.completed_at!) <= target
  })
  const slaPercent = completedOrders.length ? (withinSla.length / completedOrders.length) * 100 : 0

  const costByAsset = new Map<string, GroupMetric>()
  const costByDepartment = new Map<string, GroupMetric>()
  const costByVendor = new Map<string, GroupMetric>()
  const costByCategory = new Map<string, GroupMetric>()
  const technicianWorkload = new Map<string, GroupMetric>()
  const technicianClosed = new Map<string, number>()
  const usageByAsset = new Map<string, GroupMetric>()
  const usageByWorkOrder = new Map<string, GroupMetric>()

  for (const card of jobCards) {
    const wo = card.work_order
    const eq = wo?.equipment
    const expenseCost = (card.expenses || []).reduce((sum, expense) => sum + Number(expense.amount || 0), 0)
    const partsCost = (card.parts || []).reduce(
      (sum, part) => sum + Number(part.quantity_used || 0) * Number(part.part?.unit_cost || 0),
      0
    )
    const totalCost = expenseCost + partsCost
    if (totalCost > 0) {
      addGroup(costByAsset, eq ? `${eq.name} (${eq.tag_number})` : "Unknown asset", totalCost, eq?.department || undefined)
      addGroup(costByDepartment, eq?.department, totalCost)
      addGroup(costByVendor, eq?.manufacturer, totalCost)
      addGroup(costByCategory, eq?.category, totalCost)
    }

    const hours = (card.entries || []).reduce((sum, entry) => sum + Number(entry.duration_minutes || 0), 0) / 60
    if (hours > 0) {
      addGroup(technicianWorkload, card.technician?.full_name || "Unassigned", hours, card.technician?.department || undefined)
    }
    if (card.status === "completed") {
      const tech = card.technician?.full_name || "Unassigned"
      technicianClosed.set(tech, (technicianClosed.get(tech) || 0) + 1)
    }
  }

  for (const [tech, count] of technicianClosed.entries()) {
    const current = technicianWorkload.get(tech) || { label: tech, value: 0 }
    current.secondary = `${count} completed job cards`
    technicianWorkload.set(tech, current)
  }

  for (const usage of partsUsage) {
    addGroup(
      usageByAsset,
      usage.equipment_name && usage.tag_number ? `${usage.equipment_name} (${usage.tag_number})` : "Unassigned asset",
      Number(usage.usage_cost || 0),
      `${usage.quantity_used} used`
    )
    addGroup(
      usageByWorkOrder,
      usage.work_order_id ? `WO ${usage.work_order_id.slice(0, 8)}` : "Unassigned WO",
      Number(usage.usage_cost || 0),
      usage.part_name
    )
  }

  const inventoryTotal = inventoryValue.reduce((sum, row) => sum + Number(row.inventory_value || 0), 0)
  const inventoryRows: GroupMetric[] = [
    { label: "Inventory value", value: inventoryTotal, secondary: `${inventoryValue.length} stocked lines` },
    { label: "Low stock lines", value: lowStock.length, secondary: `${reorderSuggestions.length} reorder suggestions` },
    ...reorderSuggestions.slice(0, 20).map((row) => ({
      label: row.name,
      value: row.reorder_quantity,
      secondary: `${row.quantity_on_hand}/${row.min_threshold} at ${row.stock_location}${row.vendor_name ? ` · ${row.vendor_name}` : ""}${row.estimated_cost ? ` · ${moneyFormat(Number(row.estimated_cost))}` : ""}`,
    })),
    ...sortedGroups(usageByAsset, 10).map((row) => ({
      ...row,
      label: `Usage: ${row.label}`,
      secondary: row.secondary || "Parts usage by asset",
    })),
    ...sortedGroups(usageByWorkOrder, 10).map((row) => ({
      ...row,
      label: `WO usage: ${row.label}`,
      secondary: row.secondary || "Parts usage by work order",
    })),
  ]

  const downtimeByAsset = new Map<string, GroupMetric>()
  for (const wo of workOrders) {
    if ((wo.downtime_minutes || 0) > 0) {
      const eq = wo.equipment
      addGroup(downtimeByAsset, eq ? `${eq.name} (${eq.tag_number})` : "Unknown asset", (wo.downtime_minutes || 0) / 60)
    }
  }

  const serviceCostByEquipmentId = new Map<string, number>()
  for (const row of sortedGroups(costByAsset)) {
    const equipmentMatch = equipment.find((eq) => row.label === `${eq.name} (${eq.tag_number})`)
    if (equipmentMatch) serviceCostByEquipmentId.set(equipmentMatch.id, row.value)
  }

  const replacementRows: GroupMetric[] = equipment
    .map((eq) => {
      const equipmentForLifecycle = {
        ...eq,
        acquisition_date: eq.acquisition_date || null,
        install_date: eq.install_date || null,
        warranty_expiry: eq.warranty_expiry || null,
        support_expiry: eq.support_expiry || null,
        purchase_cost: eq.purchase_cost ?? null,
        expected_life_years: eq.expected_life_years ?? null,
        residual_value: eq.residual_value ?? null,
        current_value: eq.current_value ?? null,
        depreciation_method: eq.depreciation_method || "straight_line",
        replacement_target_date: eq.replacement_target_date || null,
        lifecycle_stage: eq.lifecycle_stage || "in_service",
        patient_impact: eq.patient_impact ?? 3,
        downtime_impact: eq.downtime_impact ?? 3,
        utilization: eq.utilization ?? 3,
        regulatory_class: eq.regulatory_class ?? 3,
        maintenance_burden: eq.maintenance_burden ?? 3,
      }
      const serviceCost = serviceCostByEquipmentId.get(eq.id) || 0
      const recommendation = getReplacementRecommendation(equipmentForLifecycle, { serviceCost }, to)
      const usefulLifeEnd = getUsefulLifeEndDate(equipmentForLifecycle)
      const ageYears = getAssetAgeYears(equipmentForLifecycle, to)
      const ageRatio = ageYears && eq.expected_life_years ? ageYears / eq.expected_life_years : 0
      const costRatio = eq.purchase_cost ? serviceCost / Number(eq.purchase_cost) : 0
      const priority =
        recommendation.status === "replace" ? 100 :
        recommendation.status === "plan" ? 70 :
        Math.max(calculateRiskScore(equipmentForLifecycle) / 2, ageRatio * 50, costRatio * 100)

      return {
        label: `${eq.name} (${eq.tag_number})`,
        value: Math.round(priority),
        secondary: [
          recommendation.label,
          usefulLifeEnd ? `life ends ${usefulLifeEnd.toISOString().slice(0, 10)}` : null,
          ageYears !== null ? `${ageYears.toFixed(1)} years old` : null,
          serviceCost > 0 ? `${moneyFormat(serviceCost)} service cost` : null,
          recommendation.reasons.join("; "),
        ].filter(Boolean).join(" · "),
      }
    })
    .filter((row) => row.value >= 50 || row.secondary?.includes("expiring") || row.secondary?.includes("Past"))
    .sort((a, b) => b.value - a.value)

  const workOrderMix = [
    { label: "Corrective", value: correctiveCount },
    { label: "Preventive", value: preventiveCount },
  ]

  const pmComplianceRows = [
    { label: "Completed on time", value: completedPm.length },
    { label: "Overdue or missed", value: overduePm.length },
  ]

  const evidenceRows: EvidenceRow[] = [
    ...duePm.map((occurrence) => ({
      id: occurrence.id,
      item: occurrence.equipment ? `${occurrence.equipment.name} PM` : "Preventive maintenance",
      owner: occurrence.schedule?.assigned_to || "Unassigned",
      status: occurrence.status,
      date: occurrence.completed_at || occurrence.missed_at || occurrence.due_at,
      evidence: occurrence.work_order_id
        ? `PM occurrence linked to WO ${occurrence.work_order_id}`
        : occurrence.schedule?.description || "PM occurrence",
    })),
    ...completedOrders.map((wo) => ({
      id: wo.id,
      item: wo.equipment ? `${wo.equipment.name} work order` : "Work order",
      owner: wo.assigned_to || "Unassigned",
      status: wo.status,
      date: wo.completed_at || wo.created_at,
      evidence: wo.description || wo.resolution_notes || "Completed work order",
    })),
  ].slice(0, 50)

  return {
    filters,
    definitions: KPI_DEFINITIONS,
    kpis: [
      kpi("mttr", mttrHours, `${numberFormat(mttrHours)} h`),
      kpi("mtbf", mtbfHours, `${numberFormat(mtbfHours)} h`),
      kpi("downtime", downtimeHours, `${numberFormat(downtimeHours)} h`),
      kpi("uptime", uptimePercent, percentFormat(uptimePercent)),
      kpi("pm-compliance", pmCompliance, percentFormat(pmCompliance)),
      kpi("overdue-pm", overduePm.length, String(overduePm.length)),
      kpi("reactive-preventive-ratio", reactivePreventiveRatio, numberFormat(reactivePreventiveRatio, 2)),
      kpi("cost-per-asset", sortedGroups(costByAsset)[0]?.value || 0, moneyFormat(sortedGroups(costByAsset)[0]?.value || 0)),
      kpi("cost-per-department", sortedGroups(costByDepartment)[0]?.value || 0, moneyFormat(sortedGroups(costByDepartment)[0]?.value || 0)),
      kpi("cost-per-vendor", sortedGroups(costByVendor)[0]?.value || 0, moneyFormat(sortedGroups(costByVendor)[0]?.value || 0)),
      kpi("cost-per-category", sortedGroups(costByCategory)[0]?.value || 0, moneyFormat(sortedGroups(costByCategory)[0]?.value || 0)),
      kpi("technician-workload", sortedGroups(technicianWorkload)[0]?.value || 0, `${numberFormat(sortedGroups(technicianWorkload)[0]?.value || 0)} h`),
      kpi("inventory-value", inventoryTotal, moneyFormat(inventoryTotal)),
      kpi("low-stock", lowStock.length, String(lowStock.length)),
      kpi("sla", slaPercent, percentFormat(slaPercent)),
    ],
    reports: {
      "executive-summary": {
        title: "Executive Summary",
        rows: [
          { label: "Assets in scope", value: equipment.length },
          { label: "Work orders", value: workOrders.length },
          { label: "Completed within SLA", value: withinSla.length, secondary: `${completedOrders.length} completed` },
          { label: "Total maintenance cost", value: sortedGroups(costByAsset).reduce((sum, row) => sum + row.value, 0) },
        ],
      },
      "pm-compliance": { title: "PM Compliance", rows: pmComplianceRows },
      "asset-reliability": { title: "Asset Reliability", rows: sortedGroups(downtimeByAsset) },
      "replacement-planning": { title: "Replacement Planning", rows: replacementRows },
      "technician-performance": { title: "Technician Performance", rows: sortedGroups(technicianWorkload) },
      "cost-analysis": { title: "Cost Analysis", rows: sortedGroups(costByDepartment) },
      "inventory": { title: "Inventory", rows: inventoryRows },
      "compliance-evidence": { title: "Compliance Evidence", rows: evidenceRows },
    },
    charts: {
      workOrderMix,
      pmCompliance: pmComplianceRows,
      reliabilityByAsset: sortedGroups(downtimeByAsset, 8),
      technicianWorkload: sortedGroups(technicianWorkload, 8),
      costByDepartment: sortedGroups(costByDepartment, 8),
    },
  }
}
