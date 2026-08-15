"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { Clock, ClipboardList, MapPin, Play, Wrench } from "lucide-react"

import { updateWorkOrderStatus } from "@/lib/actions/work-orders"
import { StatusBadge } from "@/components/shared/status-badge"
import { PriorityBadge } from "@/components/shared/priority-badge"
import { ListControls, matchesQuery, paginate, type FilterOption } from "@/components/shared/list-controls"
import { formatRelative } from "@/lib/utils/format"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import type { WorkOrder } from "@/lib/types"

type TaskFilter = "active" | "open" | "in_progress" | "preventive" | "corrective" | "done"

const taskFilters: Array<FilterOption & { value: TaskFilter }> = [
  { value: "active", label: "Active" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "preventive", label: "PM" },
  { value: "corrective", label: "Corrective" },
  { value: "done", label: "Done" },
]

function filterOrders(orders: WorkOrder[], filter: TaskFilter) {
  if (filter === "active") {
    return orders.filter((wo) => wo.status !== "completed" && wo.status !== "cancelled")
  }
  if (filter === "done") {
    return orders.filter((wo) => wo.status === "completed" || wo.status === "cancelled")
  }
  if (filter === "preventive" || filter === "corrective") {
    return orders.filter((wo) => wo.type === filter && wo.status !== "completed" && wo.status !== "cancelled")
  }
  return orders.filter((wo) => wo.status === filter)
}

function MobileTaskCard({ workOrder }: { workOrder: WorkOrder }) {
  const canStart = workOrder.status === "open"

  return (
    <article className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/work-orders/${workOrder.id}`} className="block truncate font-semibold text-foreground">
            {workOrder.equipment?.name || "Unknown equipment"}
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <ClipboardList className="h-3.5 w-3.5" />
              {workOrder.equipment?.tag_number || "No tag"}
            </span>
            {workOrder.equipment?.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {workOrder.equipment.location}
              </span>
            )}
          </div>
        </div>
        <PriorityBadge priority={workOrder.priority} />
      </div>

      <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
        {workOrder.description}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <StatusBadge status={workOrder.status} />
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium capitalize text-muted-foreground">
          <Wrench className="h-3.5 w-3.5" />
          {workOrder.type}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          {formatRelative(workOrder.created_at)}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link
          href={`/work-orders/${workOrder.id}`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Open
        </Link>
        {canStart ? (
          <form action={updateWorkOrderStatus.bind(null, workOrder.id)}>
            <input type="hidden" name="status" value="in_progress" />
            <input type="hidden" name="assigned_to" value={workOrder.assigned_to || ""} />
            <input type="hidden" name="reason" value="Started from mobile task list" />
            <Button type="submit" size="sm" className="w-full">
              <Play className="mr-1 h-4 w-4" />
              Start
            </Button>
          </form>
        ) : (
          <Link
            href={`/work-orders/${workOrder.id}`}
            className={cn(buttonVariants({ size: "sm" }))}
          >
            Continue
          </Link>
        )}
      </div>
    </article>
  )
}

function TaskSummary({ orders }: { orders: WorkOrder[] }) {
  const active = filterOrders(orders, "active").length
  const inProgress = filterOrders(orders, "in_progress").length
  const critical = orders.filter((wo) =>
    wo.priority === "critical" && wo.status !== "completed" && wo.status !== "cancelled"
  ).length

  return (
    <div className="grid grid-cols-3 gap-2 md:hidden">
      <div className="rounded-lg border bg-white p-3">
        <p className="text-xs text-muted-foreground">Active</p>
        <p className="text-xl font-semibold">{active}</p>
      </div>
      <div className="rounded-lg border bg-white p-3">
        <p className="text-xs text-muted-foreground">Working</p>
        <p className="text-xl font-semibold">{inProgress}</p>
      </div>
      <div className="rounded-lg border bg-white p-3">
        <p className="text-xs text-muted-foreground">Critical</p>
        <p className="text-xl font-semibold">{critical}</p>
      </div>
    </div>
  )
}

export function MyTasksTable({ orders, initialFilter }: { orders: WorkOrder[]; initialFilter: TaskFilter }) {
  const pageSize = 10
  const [filter, setFilter] = useState<TaskFilter>(initialFilter)
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  const filteredOrders = useMemo(() => filterOrders(orders, filter).filter((wo) => matchesQuery([
    wo.equipment?.name,
    wo.equipment?.tag_number,
    wo.equipment?.department,
    wo.equipment?.location,
    wo.description,
    wo.type,
    wo.priority,
    wo.status,
  ], query)), [filter, orders, query])
  const pageData = paginate(filteredOrders, page, pageSize)

  return (
    <div className="space-y-4">
      <TaskSummary orders={orders} />
      <ListControls
        filters={taskFilters}
        activeFilter={filter}
        onFilterChange={(value) => setFilter(value as TaskFilter)}
        query={query}
        onQueryChange={setQuery}
        searchPlaceholder="Search my tasks"
        page={pageData.page}
        totalPages={pageData.totalPages}
        totalItems={filteredOrders.length}
        pageSize={pageSize}
        onPageChange={setPage}
      />

      {filteredOrders.length === 0 ? (
        <div className="rounded-lg border bg-white p-8 text-center text-muted-foreground">
          No tasks match this filter.
        </div>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {pageData.items.map((wo) => (
              <MobileTaskCard key={wo.id} workOrder={wo} />
            ))}
          </div>

          <div className="hidden rounded-lg border bg-white md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Equipment</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageData.items.map((wo) => (
                  <TableRow key={wo.id}>
                    <TableCell>
                      <Link
                        href={`/work-orders/${wo.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {wo.equipment?.name || "-"}
                      </Link>
                    </TableCell>
                    <TableCell className="capitalize">{wo.type}</TableCell>
                    <TableCell>
                      <PriorityBadge priority={wo.priority} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={wo.status} />
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {wo.description}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatRelative(wo.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  )
}
