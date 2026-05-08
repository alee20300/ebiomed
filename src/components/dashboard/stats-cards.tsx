import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Wrench, AlertTriangle, CalendarCheck, Package } from "lucide-react"

interface Stats {
  totalEquipment: number
  openWorkOrders: number
  overduePMs: number
  lowStockParts: number
}

export function StatsCards({ stats }: { stats: Stats }) {
  const cards = [
    { title: "Total Equipment", value: stats.totalEquipment, icon: Wrench, color: "text-blue-600" },
    { title: "Open Work Orders", value: stats.openWorkOrders, icon: AlertTriangle, color: "text-orange-600" },
    { title: "Overdue PMs", value: stats.overduePMs, icon: CalendarCheck, color: "text-red-600" },
    { title: "Low Stock Parts", value: stats.lowStockParts, icon: Package, color: "text-yellow-600" },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">{card.title}</CardTitle>
            <card.icon className={`h-5 w-5 ${card.color}`} />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{card.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
