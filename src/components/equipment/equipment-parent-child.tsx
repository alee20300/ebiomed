import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { getEquipmentServiceSummary } from "@/lib/actions/equipment"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { KpiCard } from "@/components/shared/kpi-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { ArrowRight, Building2, CircleDollarSign, GitFork, MapPin, Package, Wrench } from "lucide-react"
import type { Equipment } from "@/lib/types"

interface Props {
  equipment: Equipment
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value)
}

async function getHierarchySummary(ids: string[]) {
  const summaries = await Promise.all(ids.map((id) => getEquipmentServiceSummary(id)))
  return summaries.reduce(
    (total, summary) => ({
      workOrderCount: total.workOrderCount + summary.workOrderCount,
      completedCount: total.completedCount + summary.completedCount,
      openCount: total.openCount + summary.openCount,
      downtimeMinutes: total.downtimeMinutes + summary.downtimeMinutes,
      serviceCost: total.serviceCost + summary.serviceCost,
    }),
    { workOrderCount: 0, completedCount: 0, openCount: 0, downtimeMinutes: 0, serviceCost: 0 }
  )
}

export async function EquipmentParentChild({ equipment }: Props) {
  const supabase = await createClient()
  const [{ data: parent }, { data: childRows }] = await Promise.all([
    equipment.parent_id
      ? supabase.schema("ebiomed").from("equipment").select("*").eq("id", equipment.parent_id).single()
      : Promise.resolve({ data: null }),
    supabase
      .schema("ebiomed")
      .from("equipment")
      .select("*")
      .eq("parent_id", equipment.id)
      .is("deleted_at", null)
      .order("name"),
  ])

  const children = (childRows || []) as Equipment[]
  if (!parent && children.length === 0) return null

  const hierarchyIds = [equipment.id, ...children.map((child) => child.id)]
  const rollup = await getHierarchySummary(hierarchyIds)
  const inheritedDepartment = equipment.department || (parent as Equipment | null)?.department || null
  const inheritedLocation = equipment.location || (parent as Equipment | null)?.location || null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <GitFork className="h-4 w-4" />
          Asset Hierarchy
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-4">
          <KpiCard title="Department" value={inheritedDepartment || "—"} description="Inherited department" icon={Building2} tone="blue" size="compact" />
          <KpiCard title="Location" value={inheritedLocation || "—"} description="Inherited location" icon={MapPin} tone="green" size="compact" />
          <KpiCard title="Service Rollup" value={rollup.workOrderCount} description={`${rollup.openCount} open · ${(rollup.downtimeMinutes / 60).toFixed(1)} downtime h`} icon={Wrench} tone="amber" size="compact" />
          <KpiCard title="Service Cost" value={formatMoney(rollup.serviceCost)} description="Rollup service cost" icon={CircleDollarSign} tone="violet" size="compact" />
        </div>

        {parent && (
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Parent Asset</p>
            <Link href={`/equipment/${(parent as Equipment).id}`} className="flex items-center gap-2 rounded-md border p-2 hover:bg-muted/50 transition-colors">
              <Package className="h-4 w-4 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{(parent as Equipment).name}</p>
                <p className="text-xs text-muted-foreground">
                  {(parent as Equipment).tag_number} · {(parent as Equipment).department || "No department"} · {(parent as Equipment).location || "No location"}
                </p>
              </div>
              <StatusBadge status={(parent as Equipment).status} />
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </div>
        )}

        {children.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Child Assets ({children.length})
            </p>
            <div className="space-y-1">
              {children.map((child) => (
                <Link
                  key={child.id}
                  href={`/equipment/${child.id}`}
                  className="flex items-center gap-2 rounded-md border p-2 hover:bg-muted/50 transition-colors"
                >
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{child.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {child.tag_number} · {child.department || inheritedDepartment || "No department"} · {child.location || inheritedLocation || "No location"}
                    </p>
                  </div>
                  <StatusBadge status={child.status} />
                </Link>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
