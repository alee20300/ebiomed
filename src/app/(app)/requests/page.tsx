import { Suspense } from "react"
import type { ComponentType } from "react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { CheckCircle2, ClipboardCheck, ClipboardPlus, FileCheck2 } from "lucide-react"
import { getCurrentUser } from "@/lib/actions/profiles"
import { getRequestDashboard } from "@/lib/actions/complaints"
import { RequestDashboardTable } from "@/components/requests/request-dashboard-table"
import { KpiCard, type KpiTone } from "@/components/shared/kpi-card"
import { Skeleton } from "@/components/ui/skeleton"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { requestWorkflowStatus } from "@/lib/utils/request-triage"

async function RequestList() {
  const requests = await getRequestDashboard()
  const newRequests = requests.filter((request) => requestWorkflowStatus(request) === "new").length
  const triaged = requests.filter((request) => requestWorkflowStatus(request) === "triaged").length
  const approved = requests.filter((request) => requestWorkflowStatus(request) === "approved").length
  const converted = requests.filter((request) => requestWorkflowStatus(request) === "converted").length
  const kpis: Array<{ title: string; value: number; description: string; icon: ComponentType<{ className?: string }>; tone: KpiTone }> = [
    { title: "New", value: newRequests, description: "Awaiting biomedical review", icon: ClipboardPlus, tone: "blue" },
    { title: "Triaged", value: triaged, description: "Risk and urgency assigned", icon: ClipboardCheck, tone: "amber" },
    { title: "Approved", value: approved, description: "Ready for work order", icon: CheckCircle2, tone: "green" },
    { title: "Converted", value: converted, description: "Work order created", icon: FileCheck2, tone: "violet" },
  ]

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.title} {...kpi} size="compact" />
        ))}
      </div>
      <div className="rounded-lg border bg-white p-4 sm:p-6">
        <RequestDashboardTable requests={requests} />
      </div>
    </div>
  )
}

export default async function RequestsPage() {
  const user = await getCurrentUser()
  if (!user) return redirect("/login")

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Request Portal</h2>
          <p className="text-sm text-muted-foreground">Department visibility for submitted fault reports, triage risk, and approval status</p>
        </div>
        <Link href="/requests/new" className={cn(buttonVariants({ size: "sm" }), "gap-2")}>
          <ClipboardPlus className="h-3.5 w-3.5" />
          New Request
        </Link>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <RequestList />
      </Suspense>
    </div>
  )
}
