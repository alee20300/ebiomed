import { NextResponse } from "next/server"
import { requireApiScope } from "@/lib/api/auth"
import { getReportingDashboard } from "@/lib/reports/service"
import { REPORT_LABELS, type ReportId } from "@/lib/reports/definitions"
import type { EvidenceRow, GroupMetric } from "@/lib/reports/calculations"

const reports = Object.keys(REPORT_LABELS) as ReportId[]

export async function GET(request: Request) {
  const auth = await requireApiScope(request, "read", "reports")
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const dashboard = await getReportingDashboard({
    from: searchParams.get("from") || undefined,
    to: searchParams.get("to") || undefined,
    department: searchParams.get("department") || undefined,
    site: searchParams.get("site") || undefined,
  })
  const rows = reports.flatMap((report) => {
    const rowsForReport = dashboard.reports[report].rows
    return rowsForReport.map((row) => {
      if ("item" in row) {
        const evidence = row as EvidenceRow
        return {
          report,
          report_label: REPORT_LABELS[report],
          metric: evidence.item,
          value: 1,
          detail: evidence.evidence,
          status: evidence.status,
          date: evidence.date,
        }
      }
      const metric = row as GroupMetric
      return {
        report,
        report_label: REPORT_LABELS[report],
        metric: metric.label,
        value: metric.value,
        detail: metric.secondary || null,
        status: null,
        date: null,
      }
    })
  })
  return NextResponse.json({
    generated_at: new Date().toISOString(),
    filters: dashboard.filters,
    kpis: dashboard.kpis,
    rows,
  })
}
