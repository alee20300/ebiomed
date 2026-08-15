"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { formatRelative } from "@/lib/utils/format"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { WorkOrder } from "@/lib/types"

interface Props {
  workOrders: WorkOrder[]
}

export function ActivityFeed({ workOrders }: Props) {
  const pageSize = 8
  const [filter, setFilter] = useState("all")
  const [page, setPage] = useState(1)
  const filtered = useMemo(() => {
    if (filter === "open") return workOrders.filter((wo) => wo.status === "open")
    if (filter === "in_progress") return workOrders.filter((wo) => wo.status === "in_progress")
    if (filter === "completed") return workOrders.filter((wo) => wo.status === "completed")
    if (filter === "critical") return workOrders.filter((wo) => wo.priority === "critical" || wo.priority === "high")
    return workOrders
  }, [filter, workOrders])
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * pageSize
  const visibleOrders = filtered.slice(start, start + pageSize)
  const filters = [
    { value: "all", label: "All" },
    { value: "critical", label: "Critical" },
    { value: "open", label: "Open" },
    { value: "in_progress", label: "In Progress" },
    { value: "completed", label: "Completed" },
  ]

  return (
    <div className="rounded-lg border bg-white">
      <div className="space-y-2 border-b px-4 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Recent Activity</h3>
          <span className="text-xs text-muted-foreground">{filtered.length} shown</span>
        </div>
        {workOrders.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {filters.map((item) => (
              <Button
                key={item.value}
                type="button"
                size="sm"
                variant={filter === item.value ? "default" : "outline"}
                className="h-7 shrink-0 px-2 text-xs"
                onClick={() => { setFilter(item.value); setPage(1) }}
              >
                {item.label}
              </Button>
            ))}
          </div>
        )}
      </div>
      <div className="divide-y">
        {visibleOrders.map((wo) => (
          <Link
            key={wo.id}
            href={`/work-orders/${wo.id}`}
            className="flex items-center justify-between gap-3 px-4 py-2 hover:bg-muted/50"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {wo.equipment?.name || "Unknown Equipment"}
              </p>
              <p className="truncate text-xs text-muted-foreground">{wo.description}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <StatusBadge status={wo.status} />
              <span className="text-xs text-muted-foreground">{formatRelative(wo.created_at)}</span>
            </div>
          </Link>
        ))}
        {workOrders.length === 0 && (
          <div className="px-4 py-5 text-center">
            <p className="text-sm font-medium">No activity recorded yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Create a request, scan equipment or schedule maintenance to begin.</p>
            <div className="mt-3 flex justify-center gap-2">
              <Link href="/requests/new" className={cn(buttonVariants({ size: "sm" }))}>Create request</Link>
              <Link href="/scan" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>Scan equipment</Link>
            </div>
          </div>
        )}
        {workOrders.length > 0 && visibleOrders.length === 0 && (
          <div className="px-4 py-5 text-center text-sm text-muted-foreground">No activity matches this filter.</div>
        )}
      </div>
      {workOrders.length > 0 && (
        <div className="flex items-center justify-between gap-2 border-t px-4 py-2 text-xs text-muted-foreground">
          <span>
            {filtered.length === 0 ? "No matching items" : `Showing ${start + 1}-${Math.min(start + pageSize, filtered.length)} of ${filtered.length}`}
          </span>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs"
                disabled={safePage <= 1}
                onClick={() => setPage(safePage - 1)}
              >
                Previous
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs"
                disabled={safePage >= totalPages}
                onClick={() => setPage(safePage + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
