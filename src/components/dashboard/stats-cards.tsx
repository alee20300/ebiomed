import { Wrench, AlertTriangle, CalendarCheck, Package, ClipboardList } from "lucide-react"
import { KpiCard, type KpiTone } from "@/components/shared/kpi-card"

interface Stats {
  machinesWithIssues: number
  openWorkOrders: number
  overduePMs: number
  lowStockParts: number
  pendingComplaints: number
}

export function StatsCards({ stats }: { stats: Stats }) {
  const cards = [
    {
      title: "Equipment with issues",
      value: stats.machinesWithIssues,
      icon: Wrench,
      tone: "blue" as KpiTone,
      href: "/equipment",
      context: stats.machinesWithIssues === 0 ? "No active equipment issues" : "Unresolved faults or repair status",
    },
    {
      title: "Open work orders",
      value: stats.openWorkOrders,
      icon: AlertTriangle,
      tone: "amber" as KpiTone,
      href: "/work-orders",
      context: stats.openWorkOrders === 0 ? "No open work orders" : "Open or in progress",
    },
    {
      title: "Overdue PMs",
      value: stats.overduePMs,
      icon: CalendarCheck,
      tone: "red" as KpiTone,
      href: "/pm-schedules",
      context: stats.overduePMs === 0 ? "All PMs are on schedule" : "Past due and active",
    },
    {
      title: "Low stock",
      value: stats.lowStockParts,
      icon: Package,
      tone: "green" as KpiTone,
      href: "/parts",
      context: stats.lowStockParts === 0 ? "Inventory above reorder levels" : "At or below reorder level",
    },
    {
      title: "Pending requests",
      value: stats.pendingComplaints,
      icon: ClipboardList,
      tone: "violet" as KpiTone,
      href: "/requests",
      context: stats.pendingComplaints === 0 ? "No pending user requests" : "Submitted and not converted",
    },
  ]

  return (
    <section className="rounded-lg border bg-card p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Operational snapshot</h3>
        <span className="text-xs text-muted-foreground">Summary</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((card) => (
          <KpiCard
            key={card.title}
            href={card.href}
            title={card.title}
            value={card.value}
            description={card.context}
            icon={card.icon}
            tone={card.tone}
            size="compact"
          />
        ))}
      </div>
    </section>
  )
}
