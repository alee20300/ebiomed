import { describe, expect, it } from "vitest"
import { calculateReportingDashboard, type ReportingInput } from "@/lib/reports/calculations"
import { buildReportCsv, buildReportXlsx } from "@/lib/reports/export"

const fixture: ReportingInput = {
  filters: {
    from: "2026-01-01T00:00:00.000Z",
    to: "2026-01-02T00:00:00.000Z",
  },
  equipment: [
    {
      id: "asset-1",
      name: "Ventilator",
      tag_number: "V-1",
      department: "ICU",
      category: "Life Support",
      manufacturer: "Acme",
      location: "Main",
    },
    {
      id: "asset-2",
      name: "Analyzer",
      tag_number: "A-1",
      department: "Lab",
      category: "Diagnostics",
      manufacturer: "Globex",
      location: "Main",
    },
  ],
  workOrders: [
    {
      id: "wo-1",
      equipment_id: "asset-1",
      type: "corrective",
      priority: "high",
      status: "completed",
      assigned_to: "tech-1",
      created_at: "2026-01-01T00:00:00.000Z",
      started_at: "2026-01-01T01:00:00.000Z",
      completed_at: "2026-01-01T05:00:00.000Z",
      downtime_minutes: 120,
      equipment: {
        id: "asset-1",
        name: "Ventilator",
        tag_number: "V-1",
        department: "ICU",
        category: "Life Support",
        manufacturer: "Acme",
        location: "Main",
      },
    },
    {
      id: "wo-2",
      equipment_id: "asset-2",
      type: "preventive",
      priority: "medium",
      status: "completed",
      assigned_to: "tech-2",
      created_at: "2026-01-01T02:00:00.000Z",
      started_at: "2026-01-01T03:00:00.000Z",
      completed_at: "2026-01-01T04:00:00.000Z",
      downtime_minutes: 0,
      equipment: {
        id: "asset-2",
        name: "Analyzer",
        tag_number: "A-1",
        department: "Lab",
        category: "Diagnostics",
        manufacturer: "Globex",
        location: "Main",
      },
    },
  ],
  pmSchedules: [
    {
      id: "pm-1",
      equipment_id: "asset-1",
      description: "Monthly PM",
      next_due: "2026-01-01T12:00:00.000Z",
      last_completed: "2026-01-01T10:00:00.000Z",
      assigned_to: "tech-1",
      active: true,
      equipment: {
        id: "asset-1",
        name: "Ventilator",
        tag_number: "V-1",
        department: "ICU",
        category: "Life Support",
        manufacturer: "Acme",
        location: "Main",
      },
    },
    {
      id: "pm-2",
      equipment_id: "asset-2",
      description: "Quarterly PM",
      next_due: "2026-01-01T12:00:00.000Z",
      last_completed: null,
      assigned_to: "tech-2",
      active: true,
      equipment: {
        id: "asset-2",
        name: "Analyzer",
        tag_number: "A-1",
        department: "Lab",
        category: "Diagnostics",
        manufacturer: "Globex",
        location: "Main",
      },
    },
  ],
  pmOccurrences: [
    {
      id: "occ-1",
      pm_schedule_id: "pm-1",
      equipment_id: "asset-1",
      due_at: "2026-01-01T12:00:00.000Z",
      status: "completed",
      completed_at: "2026-01-01T10:00:00.000Z",
      missed_at: null,
      work_order_id: "wo-2",
      escalation_level: "none",
      schedule: {
        id: "pm-1",
        equipment_id: "asset-1",
        description: "Monthly PM",
        next_due: "2026-01-01T12:00:00.000Z",
        last_completed: null,
        assigned_to: "tech-1",
        active: true,
      },
      equipment: {
        id: "asset-1",
        name: "Ventilator",
        tag_number: "V-1",
        department: "ICU",
        category: "Life Support",
        manufacturer: "Acme",
        location: "Main",
      },
    },
    {
      id: "occ-2",
      pm_schedule_id: "pm-2",
      equipment_id: "asset-2",
      due_at: "2026-01-01T12:00:00.000Z",
      status: "missed",
      completed_at: null,
      missed_at: "2026-01-02T12:00:00.000Z",
      work_order_id: null,
      escalation_level: "admin",
      schedule: {
        id: "pm-2",
        equipment_id: "asset-2",
        description: "Quarterly PM",
        next_due: "2026-01-01T12:00:00.000Z",
        last_completed: "2026-01-01T10:00:00.000Z",
        assigned_to: "tech-2",
        active: true,
      },
      equipment: {
        id: "asset-2",
        name: "Analyzer",
        tag_number: "A-1",
        department: "Lab",
        category: "Diagnostics",
        manufacturer: "Globex",
        location: "Main",
      },
    },
  ],
  jobCards: [
    {
      id: "jc-1",
      work_order_id: "wo-1",
      technician_id: "tech-1",
      status: "completed",
      started_at: "2026-01-01T01:00:00.000Z",
      completed_at: "2026-01-01T05:00:00.000Z",
      technician: { id: "tech-1", full_name: "Sam Tech", department: "ICU" },
      work_order: {
        id: "wo-1",
        equipment_id: "asset-1",
        type: "corrective",
        priority: "high",
        status: "completed",
        assigned_to: "tech-1",
        created_at: "2026-01-01T00:00:00.000Z",
        started_at: "2026-01-01T01:00:00.000Z",
        completed_at: "2026-01-01T05:00:00.000Z",
        downtime_minutes: 120,
        equipment: {
          id: "asset-1",
          name: "Ventilator",
          tag_number: "V-1",
          department: "ICU",
          category: "Life Support",
          manufacturer: "Acme",
          location: "Main",
        },
      },
      entries: [
        {
          id: "entry-1",
          job_card_id: "jc-1",
          started_at: "2026-01-01T01:00:00.000Z",
          ended_at: "2026-01-01T04:00:00.000Z",
          duration_minutes: 180,
        },
      ],
      expenses: [{ id: "expense-1", job_card_id: "jc-1", category: "ticket", amount: 50, description: "Taxi" }],
      parts: [{ id: "part-1", job_card_id: "jc-1", quantity_used: 2, part: { name: "Filter", unit_cost: 25, supplier: "PartsCo" } }],
    },
  ],
}

describe("calculateReportingDashboard", () => {
  it("calculates every management KPI from a fixture", () => {
    const dashboard = calculateReportingDashboard(fixture)
    const kpis = Object.fromEntries(dashboard.kpis.map((kpi) => [kpi.id, kpi.value]))

    expect(kpis.mttr).toBe(4)
    expect(kpis.mtbf).toBe(46)
    expect(kpis.downtime).toBe(2)
    expect(kpis.uptime).toBeCloseTo(95.8, 1)
    expect(kpis["pm-compliance"]).toBe(50)
    expect(kpis["overdue-pm"]).toBe(1)
    expect(kpis["reactive-preventive-ratio"]).toBe(1)
    expect(kpis["cost-per-asset"]).toBe(100)
    expect(kpis["cost-per-department"]).toBe(100)
    expect(kpis["cost-per-vendor"]).toBe(100)
    expect(kpis["cost-per-category"]).toBe(100)
    expect(kpis["technician-workload"]).toBe(3)
    expect(kpis.sla).toBe(100)
  })

  it("exports KPI and report rows to CSV and XLSX", () => {
    const dashboard = calculateReportingDashboard(fixture)
    const csv = buildReportCsv(dashboard, "executive-summary")
    const xlsx = buildReportXlsx(dashboard, "pm-compliance")

    expect(csv).toContain("Executive Summary")
    expect(csv).toContain("MTTR")
    expect(csv).toContain("Average(completed_at - started_at)")
    expect(xlsx.subarray(0, 2).toString()).toBe("PK")
  })

  it("uses occurrence history instead of schedule last_completed for PM compliance", () => {
    const dashboard = calculateReportingDashboard(fixture)
    const evidence = dashboard.reports["compliance-evidence"].rows

    expect(dashboard.kpis.find((kpi) => kpi.id === "pm-compliance")?.value).toBe(50)
    expect(evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "occ-2", status: "missed", date: "2026-01-02T12:00:00.000Z" }),
      ])
    )
  })

  it("does not count late completed PM occurrences as compliant", () => {
    const dashboard = calculateReportingDashboard({
      ...fixture,
      pmOccurrences: fixture.pmOccurrences?.map((occurrence) =>
        occurrence.id === "occ-2"
          ? { ...occurrence, status: "completed", completed_at: "2026-01-03T12:00:00.000Z", missed_at: "2026-01-02T12:00:00.000Z" }
          : occurrence
      ),
    })

    expect(dashboard.kpis.find((kpi) => kpi.id === "pm-compliance")?.value).toBe(50)
  })
})
