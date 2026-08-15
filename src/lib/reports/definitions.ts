export type ReportId =
  | "executive-summary"
  | "pm-compliance"
  | "asset-reliability"
  | "replacement-planning"
  | "technician-performance"
  | "cost-analysis"
  | "inventory"
  | "compliance-evidence"

export type KpiId =
  | "mttr"
  | "mtbf"
  | "downtime"
  | "uptime"
  | "pm-compliance"
  | "overdue-pm"
  | "reactive-preventive-ratio"
  | "cost-per-asset"
  | "cost-per-department"
  | "cost-per-vendor"
  | "cost-per-category"
  | "technician-workload"
  | "inventory-value"
  | "low-stock"
  | "sla"

export interface KpiDefinition {
  id: KpiId
  label: string
  unit: string
  formula: string
}

export const KPI_DEFINITIONS: KpiDefinition[] = [
  {
    id: "mttr",
    label: "MTTR",
    unit: "hours",
    formula: "Average(completed_at - started_at) for completed corrective work orders with both timestamps.",
  },
  {
    id: "mtbf",
    label: "MTBF",
    unit: "hours",
    formula: "Total observed uptime hours / corrective failure count in the selected date range.",
  },
  {
    id: "downtime",
    label: "Downtime",
    unit: "hours",
    formula: "Sum(work_orders.downtime_minutes) / 60 for work orders in the selected date range.",
  },
  {
    id: "uptime",
    label: "Uptime",
    unit: "%",
    formula: "((asset count * selected range hours) - downtime hours) / (asset count * selected range hours) * 100.",
  },
  {
    id: "pm-compliance",
    label: "PM Compliance",
    unit: "%",
    formula: "Preventive work orders completed on or before their due date / preventive work orders due * 100.",
  },
  {
    id: "overdue-pm",
    label: "Overdue PM",
    unit: "count",
    formula: "Active PM schedules with next_due before the end of the selected date range.",
  },
  {
    id: "reactive-preventive-ratio",
    label: "Reactive/Preventive Ratio",
    unit: "ratio",
    formula: "Corrective work order count / preventive work order count in the selected date range.",
  },
  {
    id: "cost-per-asset",
    label: "Cost per Asset",
    unit: "money",
    formula: "Job card expenses plus consumed parts cost grouped by equipment.",
  },
  {
    id: "cost-per-department",
    label: "Cost per Department",
    unit: "money",
    formula: "Job card expenses plus consumed parts cost grouped by equipment.department.",
  },
  {
    id: "cost-per-vendor",
    label: "Cost per Vendor",
    unit: "money",
    formula: "Job card expenses plus consumed parts cost grouped by equipment.manufacturer.",
  },
  {
    id: "cost-per-category",
    label: "Cost per Category",
    unit: "money",
    formula: "Job card expenses plus consumed parts cost grouped by equipment.category.",
  },
  {
    id: "technician-workload",
    label: "Technician Workload",
    unit: "hours",
    formula: "Sum(job_card_entries.duration_minutes) / 60 grouped by technician.",
  },
  {
    id: "inventory-value",
    label: "Inventory Value",
    unit: "money",
    formula: "Sum(quantity_on_hand * unit_cost) across current part stock balances.",
  },
  {
    id: "low-stock",
    label: "Low Stock",
    unit: "count",
    formula: "Count of part/location/bin balances at or below their minimum threshold.",
  },
  {
    id: "sla",
    label: "SLA",
    unit: "%",
    formula: "Completed work orders resolved within the priority SLA target / completed work orders * 100.",
  },
]

export const REPORT_LABELS: Record<ReportId, string> = {
  "executive-summary": "Executive Summary",
  "pm-compliance": "PM Compliance",
  "asset-reliability": "Asset Reliability",
  "replacement-planning": "Replacement Planning",
  "technician-performance": "Technician Performance",
  "cost-analysis": "Cost Analysis",
  "inventory": "Inventory",
  "compliance-evidence": "Compliance Evidence",
}

export const SLA_TARGET_HOURS: Record<string, number> = {
  critical: 4,
  high: 24,
  medium: 72,
  low: 168,
}
