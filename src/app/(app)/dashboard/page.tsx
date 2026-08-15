import { Suspense } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { ActivityFeed } from "@/components/dashboard/activity-feed"
import { CertificateExpiryAlert } from "@/components/dashboard/certificate-expiry-alert"
import { DashboardOperations } from "@/components/dashboard/dashboard-panels"
import { getComplaints } from "@/lib/actions/complaints"
import { getExpiringContracts } from "@/lib/actions/purchasing"
import { Skeleton } from "@/components/ui/skeleton"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ClipboardPlus } from "lucide-react"
import { addDays, isPast } from "date-fns"

async function DashboardContent() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [
    { data: equipmentStatuses },
    { count: openWOCount },
    { data: pmSchedules },
    { data: recentWOs },
    { data: myTasks },
    { data: attentionEquipment },
    { data: criticalWorkOrders },
  ] = await Promise.all([
    supabase.from("equipment").select("id, status"),
    supabase.from("work_orders").select("*", { count: "exact", head: true }).in("status", ["open", "in_progress"]),
    supabase.from("pm_schedules").select("*, equipment(*)").eq("active", true).order("next_due", { ascending: true }),
    supabase.from("work_orders").select("*, equipment(*)").order("created_at", { ascending: false }).limit(50),
    user
      ? supabase
        .from("work_orders")
        .select("*, equipment(id, name, tag_number, department, location, status, asset_criticality)")
        .eq("assigned_to", user.id)
        .in("status", ["open", "in_progress", "on_hold"])
        .order("priority", { ascending: true })
        .order("created_at", { ascending: true })
        .limit(50)
      : Promise.resolve({ data: [] }),
    supabase
      .from("equipment")
      .select("id, name, tag_number, department, location, status, asset_criticality")
      .in("status", ["under_repair", "out_of_tolerance", "inactive"])
      .limit(50),
    supabase
      .from("work_orders")
      .select("*, equipment(id, name, tag_number, department, location, status, asset_criticality)")
      .in("status", ["open", "in_progress", "on_hold"])
      .in("priority", ["critical", "high"])
      .order("created_at", { ascending: true })
      .limit(6),
  ])

  const { data: allParts } = await supabase.from("parts").select("*")
  const filteredLowParts = (allParts || []).filter(
    (p: { quantity_on_hand: number; min_threshold: number }) => p.quantity_on_hand <= p.min_threshold
  )

  const [complaints, expiringContracts] = await Promise.all([
    getComplaints(),
    getExpiringContracts(),
  ])

  const overduePMs = (pmSchedules || []).filter(
    (pm: { next_due: string | null }) => pm.next_due && isPast(new Date(pm.next_due))
  )
  const thirtyDaysFromNow = addDays(new Date(), 30)
  const upcomingPMs = (pmSchedules || []).filter(
    (pm: { next_due: string | null }) => {
      if (!pm.next_due) return false
      const due = new Date(pm.next_due)
      return due <= thirtyDaysFromNow
    }
  )

  // Count equipment with open work orders
  const { data: equipmentWithOpenWOs } = await supabase
    .from("work_orders")
    .select("equipment_id")
    .in("status", ["open", "in_progress"])

  const distinctEquipmentWithIssues = new Set(
    (equipmentWithOpenWOs || []).map((wo: { equipment_id: string }) => wo.equipment_id)
  )

  // Also count equipment with under_repair status
  const underRepairCount = (equipmentStatuses || []).filter(
    (eq: { status: string }) => eq.status === "under_repair"
  ).length

  const machinesWithIssues = Math.max(
    distinctEquipmentWithIssues.size,
    underRepairCount
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/requests/new" className={cn(buttonVariants({ size: "sm" }))}>
            <ClipboardPlus className="h-3.5 w-3.5" />
            New Request
          </Link>
        </div>
      </div>

      <StatsCards stats={{
        machinesWithIssues,
        openWorkOrders: openWOCount || 0,
        overduePMs: overduePMs.length,
        lowStockParts: filteredLowParts?.length || 0,
        pendingComplaints: complaints.length,
      }} />

      <DashboardOperations
        myTasks={myTasks || []}
        upcomingPMs={upcomingPMs}
        attentionEquipment={attentionEquipment || []}
        lowParts={filteredLowParts || []}
        criticalWorkOrders={criticalWorkOrders || []}
        complaints={complaints}
        contracts={expiringContracts}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <CertificateExpiryAlert />
      </div>

      <ActivityFeed workOrders={recentWOs || []} />
    </div>
  )
}

export default function DashboardPage() {
  return (
    <div className="space-y-4">
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <DashboardContent />
      </Suspense>
    </div>
  )
}
