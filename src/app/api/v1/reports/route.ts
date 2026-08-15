import { NextResponse } from "next/server"
import { requireApiScope } from "@/lib/api/auth"
import { getReportingDashboard } from "@/lib/reports/service"
import type { ReportingFilters } from "@/lib/reports/calculations"

export async function GET(request: Request) {
  const auth = await requireApiScope(request, "read", "reports")
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
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
  return NextResponse.json(dashboard)
}
