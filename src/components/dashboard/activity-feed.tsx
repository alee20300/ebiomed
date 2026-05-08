import Link from "next/link"
import { formatRelative } from "@/lib/utils/format"
import { StatusBadge } from "@/components/shared/status-badge"
import type { WorkOrder } from "@/lib/types"

interface Props {
  workOrders: WorkOrder[]
}

export function ActivityFeed({ workOrders }: Props) {
  return (
    <div className="rounded-lg border bg-white">
      <div className="border-b px-6 py-4">
        <h3 className="font-semibold">Recent Activity</h3>
      </div>
      <div className="divide-y">
        {workOrders.slice(0, 10).map((wo) => (
          <Link
            key={wo.id}
            href={`/work-orders/${wo.id}`}
            className="flex items-center justify-between px-6 py-3 hover:bg-gray-50"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {wo.equipment?.name || "Unknown Equipment"}
              </p>
              <p className="truncate text-xs text-gray-500">{wo.description}</p>
            </div>
            <div className="ml-4 flex items-center gap-3">
              <StatusBadge status={wo.status} />
              <span className="text-xs text-gray-400">{formatRelative(wo.created_at)}</span>
            </div>
          </Link>
        ))}
        {workOrders.length === 0 && (
          <div className="px-6 py-8 text-center text-sm text-gray-500">
            No recent activity.
          </div>
        )}
      </div>
    </div>
  )
}
