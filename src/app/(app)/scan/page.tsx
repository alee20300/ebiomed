import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/lib/actions/profiles"
import { updateWorkOrderStatus } from "@/lib/actions/work-orders"
import { TechnicianScanner } from "@/components/technician/technician-scanner"
import { StatusBadge } from "@/components/shared/status-badge"
import { PriorityBadge } from "@/components/shared/priority-badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { formatRelative } from "@/lib/utils/format"
import { ClipboardList, MapPin, Plus, ScanLine, Wrench } from "lucide-react"
import type { Equipment, WorkOrder } from "@/lib/types"

interface PageProps {
  searchParams?: Promise<{ tag?: string }>
}

async function getScanContext(tag: string) {
  const supabase = await createClient()

  const { data: equipment } = await supabase
    .from("equipment")
    .select("*")
    .eq("tag_number", tag)
    .single()

  if (!equipment) {
    return { equipment: null, workOrders: [] as WorkOrder[] }
  }

  const typedEquipment = equipment as Equipment
  const { data: workOrders } = await supabase
    .from("work_orders")
    .select("*, equipment(*)")
    .eq("equipment_id", typedEquipment.id)
    .in("status", ["open", "in_progress", "on_hold"])
    .order("created_at", { ascending: false })

  return {
    equipment: typedEquipment,
    workOrders: (workOrders || []) as unknown as WorkOrder[],
  }
}

function WorkOrderAction({ workOrder }: { workOrder: WorkOrder }) {
  if (workOrder.status !== "open") {
    return (
      <Link
        href={`/work-orders/${workOrder.id}`}
        className={cn(buttonVariants({ size: "sm" }), "w-full sm:w-auto")}
      >
        Continue
      </Link>
    )
  }

  return (
    <form action={updateWorkOrderStatus.bind(null, workOrder.id)} className="w-full sm:w-auto">
      <input type="hidden" name="status" value="in_progress" />
      <input type="hidden" name="assigned_to" value={workOrder.assigned_to || ""} />
      <input type="hidden" name="reason" value="Started from scan workflow" />
      <Button type="submit" size="sm" className="w-full">
        Start
      </Button>
    </form>
  )
}

export default async function ScanPage({ searchParams }: PageProps) {
  const user = await getCurrentUser()
  if (!user) redirect("/login")
  if (user.role === "viewer") redirect("/dashboard")

  const params = await searchParams
  const tag = params?.tag?.trim()
  const context = tag ? await getScanContext(tag) : null

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <ScanLine className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold tracking-tight">Scan Asset</h2>
        </div>
        <p className="text-sm text-muted-foreground">Open equipment, start assigned work, or create a new corrective order.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Asset Lookup</CardTitle>
        </CardHeader>
        <CardContent>
          <TechnicianScanner />
        </CardContent>
      </Card>

      {tag && context?.equipment === null && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
          <p className="font-medium text-destructive">Equipment not found</p>
          <p className="mt-1 text-sm text-muted-foreground">No equipment exists with tag &quot;{tag}&quot;.</p>
        </div>
      )}

      {context?.equipment && (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold">{context.equipment.name}</h3>
                    <StatusBadge status={context.equipment.status} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <ClipboardList className="h-4 w-4" />
                      {context.equipment.tag_number}
                    </span>
                    {context.equipment.location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {context.equipment.location}
                      </span>
                    )}
                  </div>
                  {context.equipment.department && (
                    <p className="mt-1 text-sm text-muted-foreground">{context.equipment.department}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
                  <Link
                    href={`/equipment/${context.equipment.id}`}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                  >
                    Asset
                  </Link>
                  <Link
                    href={`/work-orders/new?equipment_id=${context.equipment.id}`}
                    className={cn(buttonVariants({ size: "sm" }))}
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    New WO
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Active Work Orders</h3>
              <span className="text-sm text-muted-foreground">{context.workOrders.length}</span>
            </div>

            {context.workOrders.length === 0 ? (
              <div className="rounded-lg border bg-white p-6 text-center text-sm text-muted-foreground">
                No active work orders for this asset.
              </div>
            ) : (
              context.workOrders.map((workOrder) => (
                <article key={workOrder.id} className="rounded-lg border bg-white p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={workOrder.status} />
                        <PriorityBadge priority={workOrder.priority} />
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium capitalize text-muted-foreground">
                          <Wrench className="h-3.5 w-3.5" />
                          {workOrder.type}
                        </span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm">{workOrder.description}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Created {formatRelative(workOrder.created_at)}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
                      <Link
                        href={`/work-orders/${workOrder.id}`}
                        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                      >
                        Open
                      </Link>
                      <WorkOrderAction workOrder={workOrder} />
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
