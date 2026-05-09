import { redirect } from "next/navigation"
import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/lib/actions/profiles"
import { ComplianceChart } from "@/components/reports/compliance-chart"
import { ReportsDateFilter } from "@/components/reports/reports-date-filter"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

async function ReportsContent({ from, to }: { from?: string; to?: string }) {
  const supabase = await createClient()

  const fromDate = from ? new Date(from).toISOString() : new Date(new Date().setDate(1)).toISOString()
  const toDate = to ? new Date(new Date(to).setHours(23, 59, 59, 999)).toISOString() : new Date().toISOString()

  const { count: totalPMs } = await supabase
    .from("pm_schedules")
    .select("*", { count: "exact", head: true })
    .eq("active", true)

  const { count: completedPMs } = await supabase
    .from("pm_schedules")
    .select("*", { count: "exact", head: true })
    .eq("active", true)
    .not("last_completed", "is", null)

  const { data: equipmentByStatus } = await supabase.from("equipment").select("status")
  const { data: recentWOs } = await supabase
    .from("work_orders")
    .select("status, created_at, priority")
    .gte("created_at", fromDate)
    .lte("created_at", toDate)

  const statusCounts: Record<string, number> = {}
  equipmentByStatus?.forEach((eq: { status: string }) => {
    statusCounts[eq.status] = (statusCounts[eq.status] || 0) + 1
  })

  const woStatusCounts: Record<string, number> = {}
  recentWOs?.forEach((wo: { status: string }) => {
    woStatusCounts[wo.status] = (woStatusCounts[wo.status] || 0) + 1
  })

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>PM Compliance</CardTitle>
          </CardHeader>
          <CardContent>
            <ComplianceChart completed={completedPMs || 0} total={totalPMs || 0} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Equipment by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(statusCounts).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <span className="text-sm capitalize">{status.replace("_", " ")}</span>
                  <div className="flex items-center gap-2">
                    <div className="h-2 rounded-full bg-primary" style={{ width: `${(count / (equipmentByStatus?.length || 1)) * 200}px` }} />
                    <span className="text-sm font-medium">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Work Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(woStatusCounts).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <span className="text-sm capitalize">{status.replace("_", " ")}</span>
                  <div className="flex items-center gap-2">
                    <div className="h-2 rounded-full bg-blue-500" style={{ width: `${(count / Math.max((recentWOs?.length || 1), 1)) * 200}px` }} />
                    <span className="text-sm font-medium">{count}</span>
                  </div>
                </div>
              ))}
            </div>
            {(!recentWOs || recentWOs.length === 0) && (
              <p className="py-8 text-center text-sm text-gray-500">No work orders in selected date range.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">Total Equipment</p>
              <p className="text-2xl font-bold">{equipmentByStatus?.length || 0}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Active PM Schedules</p>
              <p className="text-2xl font-bold">{totalPMs || 0}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">PM Compliance Rate</p>
              <p className="text-2xl font-bold">
                {totalPMs ? Math.round(((completedPMs || 0) / totalPMs) * 100) : 0}%
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const user = await getCurrentUser()
  if (user?.role === "viewer") redirect("/dashboard")

  const { from, to } = await searchParams

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Reports</h2>
        <ReportsDateFilter />
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <ReportsContent from={from} to={to} />
      </Suspense>
    </div>
  )
}
