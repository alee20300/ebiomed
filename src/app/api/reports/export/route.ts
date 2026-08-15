import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/actions/profiles"
import { REPORT_LABELS, type ReportId } from "@/lib/reports/definitions"
import { buildReportCsv, buildReportPdf, buildReportXlsx } from "@/lib/reports/export"
import { getReportingDashboard } from "@/lib/reports/service"
import type { ReportingFilters } from "@/lib/reports/calculations"

export const dynamic = "force-dynamic"

const reports = Object.keys(REPORT_LABELS) as ReportId[]

function pickReport(value: string | null): ReportId {
  return reports.includes(value as ReportId) ? (value as ReportId) : "executive-summary"
}

export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user || user.role === "viewer") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const report = pickReport(searchParams.get("report"))
  const format = searchParams.get("format") || "csv"
  const filters: ReportingFilters = {
    from: searchParams.get("from") || undefined,
    to: searchParams.get("to") || undefined,
    department: searchParams.get("department") || undefined,
    category: searchParams.get("category") || undefined,
    technician: searchParams.get("technician") || undefined,
    priority: searchParams.get("priority") || undefined,
    vendor: searchParams.get("vendor") || undefined,
    site: searchParams.get("site") || undefined,
  }
  const dashboard = await getReportingDashboard(filters)
  const filename = `${report}-${dashboard.filters.from.slice(0, 10)}-${dashboard.filters.to.slice(0, 10)}`

  if (format === "xlsx") {
    return new NextResponse(buildReportXlsx(dashboard, report), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
      },
    })
  }

  if (format === "pdf") {
    return new NextResponse(await buildReportPdf(dashboard, report), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}.pdf"`,
      },
    })
  }

  return new NextResponse(buildReportCsv(dashboard, report), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}.csv"`,
    },
  })
}
