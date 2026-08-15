import Link from "next/link"
import { AlertTriangle, Building2, CalendarClock, CheckCircle2, FilePlus2, Play } from "lucide-react"
import { getPMDashboardData } from "@/lib/actions/pm-dashboard"
import { runPMEngineNow, skipPMOccurrence } from "@/lib/actions/pm-engine"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { KpiCard } from "@/components/shared/kpi-card"
import { ResponsiveTableFrame } from "@/components/shared/responsive-table-frame"

function formatDate(value: string) {
  return new Date(value).toLocaleDateString()
}

function getEscalation(row: unknown) {
  return typeof row === "object" && row !== null && "escalation" in row && typeof row.escalation === "string"
    ? row.escalation
    : "none"
}

export async function PMDashboard() {
  const data = await getPMDashboardData()

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex justify-end">
        <form action={runPMEngineNow}>
          <Button type="submit" variant="outline" size="sm">
            <Play className="mr-1 h-4 w-4" />
            Run PM Engine
          </Button>
        </form>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Due Soon" value={data.dueSoon.length} description="Scheduled in the active window" icon={CalendarClock} tone="blue" size="compact" />
        <KpiCard title="Overdue" value={data.overdue.length} description="Past due and active" icon={AlertTriangle} tone="red" size="compact" />
        <KpiCard title="Compliance" value={`${data.compliancePercent}%`} description="Completed on schedule" icon={CheckCircle2} tone="green" size="compact" />
        <KpiCard title="Generated WOs" value={data.generatedWorkOrders.length} description="Created by PM engine" icon={FilePlus2} tone="violet" size="compact" />
      </div>

      <Tabs defaultValue="due" className="w-full min-w-0">
        <div className="overflow-x-auto pb-1">
          <TabsList className="min-w-max">
            <TabsTrigger value="due">Due PMs</TabsTrigger>
            <TabsTrigger value="generated">Generated WOs</TabsTrigger>
            <TabsTrigger value="missed">Missed</TabsTrigger>
            <TabsTrigger value="engine">Engine Runs</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="due" className="mt-2 min-w-0">
        <Card>
          <CardHeader><CardTitle>Due Soon / Overdue PMs</CardTitle></CardHeader>
          <CardContent className="min-w-0">
            <ResponsiveTableFrame className="border-0">
            <Table className="min-w-[760px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Equipment</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Escalation</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...data.overdue, ...data.dueSoon].slice(0, 8).map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.equipment}</TableCell>
                    <TableCell>{formatDate(row.due_at)}</TableCell>
                    <TableCell>{row.department}</TableCell>
                    <TableCell><Badge variant={getEscalation(row) !== "none" ? "warning" : "outline"}>{getEscalation(row)}</Badge></TableCell>
                    <TableCell>
                      {row.workOrderId ? (
                        <Link href={`/work-orders/${row.workOrderId}`} className="text-sm font-medium text-primary hover:underline">
                          Open WO
                        </Link>
                      ) : (
                        <form action={skipPMOccurrence.bind(null, row.id)} className="flex min-w-56 items-center gap-2">
                          <Input name="reason" placeholder="Skip reason" className="h-8" />
                          <Button size="sm" type="submit" variant="outline">Skip</Button>
                        </form>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {data.overdue.length === 0 && data.dueSoon.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="py-6 text-center text-muted-foreground">No due PM occurrences.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
            </ResponsiveTableFrame>
          </CardContent>
        </Card>
        </TabsContent>
        <TabsContent value="generated" className="mt-2 min-w-0">
        <Card>
          <CardHeader><CardTitle>Generated PM Work Orders</CardTitle></CardHeader>
          <CardContent className="min-w-0">
            <ResponsiveTableFrame className="border-0">
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Work Order</TableHead>
                  <TableHead>Equipment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.generatedWorkOrders.map((wo) => (
                  <TableRow key={wo.id}>
                    <TableCell><Link href={`/work-orders/${wo.id}`} className="text-primary hover:underline">{wo.id.slice(0, 8)}</Link></TableCell>
                    <TableCell className="font-medium">{wo.equipment}</TableCell>
                    <TableCell><Badge variant="outline">{wo.status}</Badge></TableCell>
                    <TableCell>{formatDate(wo.created_at)}</TableCell>
                  </TableRow>
                ))}
                {data.generatedWorkOrders.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="py-6 text-center text-muted-foreground">No generated PM work orders.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
            </ResponsiveTableFrame>
          </CardContent>
        </Card>
        </TabsContent>
        <TabsContent value="missed" className="mt-2 min-w-0">
      <Card>
        <CardHeader><CardTitle>Missed PMs by Department</CardTitle></CardHeader>
        <CardContent className="min-w-0">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {data.missedByDepartment.map((row) => (
              <KpiCard
                key={row.department}
                title={row.department}
                value={row.missed}
                description="Missed PMs"
                icon={Building2}
                tone="red"
                size="compact"
              />
            ))}
            {data.missedByDepartment.length === 0 && <p className="text-sm text-muted-foreground">No missed PMs recorded.</p>}
          </div>
        </CardContent>
      </Card>
        </TabsContent>
        <TabsContent value="engine" className="mt-2 min-w-0">
      <Card>
        <CardHeader><CardTitle>PM Engine Run History</CardTitle></CardHeader>
        <CardContent className="min-w-0">
          <ResponsiveTableFrame className="border-0">
          <Table className="min-w-[860px]">
            <TableHeader>
              <TableRow>
                <TableHead>Started</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Checked</TableHead>
                <TableHead>Occurrences</TableHead>
                <TableHead>WOs</TableHead>
                <TableHead>Escalations</TableHead>
                <TableHead>Failures</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.engineRuns.map((run) => (
                <TableRow key={run.id}>
                  <TableCell>{formatDate(run.started_at)}</TableCell>
                  <TableCell><Badge variant={run.status === "success" ? "success" : run.status === "partial_failure" ? "warning" : "destructive"}>{run.status.replaceAll("_", " ")}</Badge></TableCell>
                  <TableCell>{run.checked_schedules}</TableCell>
                  <TableCell>{run.created_occurrences}</TableCell>
                  <TableCell>{run.generated_work_orders}</TableCell>
                  <TableCell>{run.escalations}</TableCell>
                  <TableCell>
                    {run.failures}
                    {run.failure_details?.[0] && (
                      <p className="max-w-64 truncate text-xs text-muted-foreground">{run.failure_details[0].message}</p>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {data.engineRuns.length === 0 && (
                <TableRow><TableCell colSpan={7} className="py-6 text-center text-muted-foreground">No PM engine runs recorded.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          </ResponsiveTableFrame>
        </CardContent>
      </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
