import Link from "next/link"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { Activity, Clock, FileCheck, Gauge, ShieldCheck, Wrench } from "lucide-react"
import { getCurrentUser } from "@/lib/actions/profiles"
import { getReportingDashboard, getReportingFilterOptions } from "@/lib/reports/service"
import { REPORT_LABELS, type ReportId } from "@/lib/reports/definitions"
import type { EvidenceRow, GroupMetric, KpiValue, ReportingDashboard, ReportingFilters } from "@/lib/reports/calculations"
import { ReportsDateFilter } from "@/components/reports/reports-date-filter"
import { ReportBarChart, ReportPieChart } from "@/components/reports/report-charts"
import { KpiCard, type KpiTone } from "@/components/shared/kpi-card"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const REPORTS: ReportId[] = [
  "executive-summary",
  "pm-compliance",
  "asset-reliability",
  "replacement-planning",
  "technician-performance",
  "cost-analysis",
  "inventory",
  "compliance-evidence",
]

const KPI_ICONS = [Clock, Activity, Wrench, Gauge, FileCheck, ShieldCheck]
const KPI_TONES: KpiTone[] = ["blue", "green", "amber", "violet", "red"]

function pickReport(value?: string): ReportId {
  return REPORTS.includes(value as ReportId) ? (value as ReportId) : "executive-summary"
}

function linkForReport(report: ReportId, filters: ReportingFilters) {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value)
  })
  params.set("report", report)
  return `/reports?${params.toString()}`
}

function KpiGrid({ kpis }: { kpis: KpiValue[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {kpis.map((kpi, index) => {
        const Icon = KPI_ICONS[index % KPI_ICONS.length]
        return (
          <KpiCard
            key={kpi.id}
            title={kpi.label}
            value={kpi.displayValue}
            description={kpi.formula}
            icon={Icon}
            tone={KPI_TONES[index % KPI_TONES.length]}
          />
        )
      })}
    </div>
  )
}

function MetricTable({ rows, valueLabel = "Value" }: { rows: GroupMetric[]; valueLabel?: string }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Metric</TableHead>
          <TableHead className="text-right">{valueLabel}</TableHead>
          <TableHead>Detail</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.label}>
            <TableCell className="font-medium">{row.label}</TableCell>
            <TableCell className="text-right">{Number.isInteger(row.value) ? row.value : row.value.toFixed(1)}</TableCell>
            <TableCell className="text-muted-foreground">{row.secondary || "—"}</TableCell>
          </TableRow>
        ))}
        {rows.length === 0 && (
          <TableRow>
            <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">No data in this range.</TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}

function EvidenceTable({ rows }: { rows: EvidenceRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Item</TableHead>
          <TableHead>Owner</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Evidence</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="font-medium">{row.item}</TableCell>
            <TableCell>{row.owner}</TableCell>
            <TableCell><Badge variant="outline">{row.status}</Badge></TableCell>
            <TableCell>{row.date ? row.date.slice(0, 10) : "—"}</TableCell>
            <TableCell className="text-muted-foreground">{row.evidence}</TableCell>
          </TableRow>
        ))}
        {rows.length === 0 && (
          <TableRow>
            <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No evidence in this range.</TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}

function ReportContent({ dashboard, report }: { dashboard: ReportingDashboard; report: ReportId }) {
  const rows = dashboard.reports[report].rows

  if (report === "pm-compliance") {
    return (
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader><CardTitle>Completion Mix</CardTitle></CardHeader>
          <CardContent><ReportPieChart data={dashboard.charts.pmCompliance} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>PM Compliance Table</CardTitle></CardHeader>
          <CardContent><MetricTable rows={rows as GroupMetric[]} /></CardContent>
        </Card>
      </div>
    )
  }

  if (report === "asset-reliability") {
    return (
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Downtime by Asset</CardTitle></CardHeader>
          <CardContent><ReportBarChart data={dashboard.charts.reliabilityByAsset} valueLabel="Downtime hours" /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Reliability Detail</CardTitle></CardHeader>
          <CardContent><MetricTable rows={rows as GroupMetric[]} valueLabel="Hours" /></CardContent>
        </Card>
      </div>
    )
  }

  if (report === "replacement-planning") {
    return (
      <Card>
        <CardHeader><CardTitle>Replacement Planning</CardTitle></CardHeader>
        <CardContent><MetricTable rows={rows as GroupMetric[]} valueLabel="Priority" /></CardContent>
      </Card>
    )
  }

  if (report === "technician-performance") {
    return (
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Workload Hours</CardTitle></CardHeader>
          <CardContent><ReportBarChart data={dashboard.charts.technicianWorkload} valueLabel="Hours" /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Technician Workload</CardTitle></CardHeader>
          <CardContent><MetricTable rows={rows as GroupMetric[]} valueLabel="Hours" /></CardContent>
        </Card>
      </div>
    )
  }

  if (report === "cost-analysis") {
    return (
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Cost by Department</CardTitle></CardHeader>
          <CardContent><ReportBarChart data={dashboard.charts.costByDepartment} valueLabel="Cost" /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Cost Detail</CardTitle></CardHeader>
          <CardContent><MetricTable rows={rows as GroupMetric[]} valueLabel="Cost" /></CardContent>
        </Card>
      </div>
    )
  }

  if (report === "compliance-evidence") {
    return (
      <Card>
        <CardHeader><CardTitle>Compliance Evidence</CardTitle></CardHeader>
        <CardContent><EvidenceTable rows={rows as EvidenceRow[]} /></CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Work Order Mix</CardTitle></CardHeader>
        <CardContent><ReportPieChart data={dashboard.charts.workOrderMix} /></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Executive Summary</CardTitle></CardHeader>
        <CardContent><MetricTable rows={rows as GroupMetric[]} /></CardContent>
      </Card>
    </div>
  )
}

async function ReportsContent({ filters, report }: { filters: ReportingFilters; report: ReportId }) {
  const [dashboard, options] = await Promise.all([
    getReportingDashboard(filters),
    getReportingFilterOptions(),
  ])

  return (
    <div className="space-y-6">
      <ReportsDateFilter options={options} report={report} />
      <div className="flex flex-wrap gap-2">
        {REPORTS.map((item) => (
          <Link
            key={item}
            href={linkForReport(item, filters)}
            className={cn(buttonVariants({ variant: item === report ? "default" : "outline", size: "sm" }))}
          >
            {REPORT_LABELS[item]}
          </Link>
        ))}
      </div>
      <KpiGrid kpis={dashboard.kpis} />
      <ReportContent dashboard={dashboard} report={report} />
    </div>
  )
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<ReportingFilters & { report?: string }>
}) {
  const user = await getCurrentUser()
  if (user?.role === "viewer") redirect("/dashboard")

  const params = await searchParams
  const report = pickReport(params.report)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Management Reports</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          KPI-backed dashboards for executive, maintenance, cost, and compliance review.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <ReportsContent filters={params} report={report} />
      </Suspense>
    </div>
  )
}
