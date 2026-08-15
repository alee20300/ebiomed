import { Suspense } from "react"
import type { ComponentType } from "react"
import { redirect } from "next/navigation"
import { getComplaints } from "@/lib/actions/complaints"
import { getCurrentUser } from "@/lib/actions/profiles"
import { ComplaintTable } from "@/components/complaints/complaint-table"
import { Skeleton } from "@/components/ui/skeleton"
import { KpiCard, type KpiTone } from "@/components/shared/kpi-card"
import { AlertTriangle, ClipboardCheck, ShieldAlert, Timer } from "lucide-react"

function isSlaOverdue(slaDueAt: string) {
  return new Date(slaDueAt).getTime() < Date.now()
}

async function ComplaintList() {
  const complaints = await getComplaints()
  const overdue = complaints.filter((complaint) => isSlaOverdue(complaint.sla_due_at)).length
  const emergency = complaints.filter((complaint) => complaint.urgency === "emergency").length
  const safetyCritical = complaints.filter((complaint) => complaint.patient_safety_risk === "critical").length
  const kpis: Array<{
    title: string
    value: number
    description: string
    icon: ComponentType<{ className?: string }>
    tone: KpiTone
  }> = [
    { title: "Pending review", value: complaints.length, description: "Submitted fault reports", icon: ClipboardCheck, tone: "blue" },
    { title: "SLA overdue", value: overdue, description: "Needs immediate action", icon: Timer, tone: "red" },
    { title: "Emergency", value: emergency, description: "Highest urgency", icon: AlertTriangle, tone: "amber" },
    { title: "Safety critical", value: safetyCritical, description: "Patient safety risk", icon: ShieldAlert, tone: "violet" },
  ]

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.title} {...kpi} size="compact" />
        ))}
      </div>
      <div className="rounded-lg border bg-white p-4 sm:p-6">
        <ComplaintTable complaints={complaints} />
      </div>
    </div>
  )
}

export default async function ComplaintsPage() {
  const user = await getCurrentUser()
  if (!user) return redirect("/login")
  if (user.role === "viewer") return redirect("/dashboard")

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Review Queue</h2>
        <p className="text-sm text-muted-foreground">Approve or reject requester fault reports, then convert approved requests into work orders.</p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <ComplaintList />
      </Suspense>
    </div>
  )
}
