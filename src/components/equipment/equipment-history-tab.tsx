import Link from "next/link"
import { StatusBadge } from "@/components/shared/status-badge"
import { PriorityBadge } from "@/components/shared/priority-badge"
import { formatDateTime } from "@/lib/utils/format"
import type { WorkOrder } from "@/lib/types"

interface Props {
  equipmentId: string
}

export async function EquipmentHistoryTab({ equipmentId }: Props) {
  // Dynamic import to avoid top-level await issues in client boundary
  const { createClient } = await import("@/lib/supabase/server")
  const supabase = await createClient()

  const { data } = await supabase
    .from("work_orders")
    .select("*")
    .eq("equipment_id", equipmentId)
    .order("created_at", { ascending: false })

  const workOrders = (data || []) as WorkOrder[]

  if (workOrders.length === 0) {
    return (
      <div className="py-8 text-center text-gray-500">
        No work orders for this equipment yet.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {workOrders.map((wo) => (
        <Link
          key={wo.id}
          href={`/work-orders/${wo.id}`}
          className="flex items-center justify-between rounded-lg border p-3 hover:bg-gray-50"
        >
          <div>
            <div className="flex items-center gap-2">
              <StatusBadge status={wo.status} />
              <PriorityBadge priority={wo.priority} />
              <span className="text-xs text-gray-500 uppercase">{wo.type}</span>
            </div>
            <p className="mt-1 line-clamp-1 text-sm">{wo.description}</p>
          </div>
          <span className="text-xs text-gray-500">{formatDateTime(wo.created_at)}</span>
        </Link>
      ))}
    </div>
  )
}
