import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { ActivityFeed } from "@/components/dashboard/activity-feed"
import { OverduePMAlert } from "@/components/dashboard/overdue-pm-alert"
import { LowStockAlert } from "@/components/dashboard/low-stock-alert"
import { EquipmentSearch } from "@/components/dashboard/equipment-search"
import { Skeleton } from "@/components/ui/skeleton"
import { isPast } from "date-fns"

async function DashboardContent() {
  const supabase = await createClient()

  const [
    { data: equipmentStatuses },
    { count: openWOCount },
    { data: pmSchedules },
    { data: recentWOs },
  ] = await Promise.all([
    supabase.from("equipment").select("id, status"),
    supabase.from("work_orders").select("*", { count: "exact", head: true }).in("status", ["open", "in_progress"]),
    supabase.from("pm_schedules").select("*, equipment(*)").eq("active", true).order("next_due", { ascending: true }),
    supabase.from("work_orders").select("*, equipment(*)").order("created_at", { ascending: false }).limit(10),
  ])

  const { data: allParts } = await supabase.from("parts").select("*")
  const filteredLowParts = (allParts || []).filter(
    (p: { quantity_on_hand: number; min_threshold: number }) => p.quantity_on_hand <= p.min_threshold
  )

  const overduePMs = (pmSchedules || []).filter(
    (pm: { next_due: string | null }) => pm.next_due && isPast(new Date(pm.next_due))
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
    <div className="space-y-6">
      <EquipmentSearch />
      <StatsCards stats={{
        machinesWithIssues,
        openWorkOrders: openWOCount || 0,
        overduePMs: overduePMs.length,
        lowStockParts: filteredLowParts?.length || 0,
      }} />
      <div className="grid gap-6 lg:grid-cols-2">
        <OverduePMAlert schedules={pmSchedules || []} />
        <LowStockAlert parts={filteredLowParts || []} />
      </div>
      <ActivityFeed workOrders={recentWOs || []} />
    </div>
  )
}

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <DashboardContent />
      </Suspense>
    </div>
  )
}
