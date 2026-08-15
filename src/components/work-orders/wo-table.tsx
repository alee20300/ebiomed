"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { StatusBadge } from "@/components/shared/status-badge"
import { PriorityBadge } from "@/components/shared/priority-badge"
import { formatDateTime, formatRelative } from "@/lib/utils/format"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ListControls, matchesQuery, paginate } from "@/components/shared/list-controls"
import type { WorkOrder } from "@/lib/types"

interface Props {
  data: WorkOrder[]
}

export function WorkOrderTable({ data }: Props) {
  const pageSize = 15
  const [filter, setFilter] = useState("active")
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  const filteredData = useMemo(() => data.filter((wo) => {
    const matchesFilter =
      filter === "all" ||
      (filter === "active" && wo.status !== "completed" && wo.status !== "cancelled") ||
      wo.status === filter ||
      wo.priority === filter ||
      wo.type === filter

    return matchesFilter && matchesQuery([
      wo.equipment?.name,
      wo.equipment?.tag_number,
      wo.description,
      wo.type,
      wo.priority,
      wo.status,
    ], query)
  }), [data, filter, query])
  const pageData = paginate(filteredData, page, pageSize)
  const filters = [
    { value: "active", label: "Active" },
    { value: "all", label: "All" },
    { value: "critical", label: "Critical" },
    { value: "high", label: "High" },
    { value: "open", label: "Open" },
    { value: "in_progress", label: "In Progress" },
    { value: "preventive", label: "PM" },
    { value: "corrective", label: "Corrective" },
    { value: "completed", label: "Completed" },
  ]

  if (data.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-8 text-center text-muted-foreground">
        No work orders found. Create your first work order.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <ListControls
        filters={filters}
        activeFilter={filter}
        onFilterChange={setFilter}
        query={query}
        onQueryChange={setQuery}
        searchPlaceholder="Search work orders"
        page={pageData.page}
        totalPages={pageData.totalPages}
        totalItems={filteredData.length}
        pageSize={pageSize}
        onPageChange={setPage}
      />
    <div className="rounded-lg border bg-white">
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
                  {wo.equipment?.name || "Unknown"}
                </Link>
              </TableCell>
              <TableCell className="text-xs uppercase text-muted-foreground">{wo.type}</TableCell>
              <TableCell>
                <PriorityBadge priority={wo.priority} />
              </TableCell>
              <TableCell>
                <StatusBadge status={wo.status} />
              </TableCell>
              <TableCell className="max-w-xs truncate">{wo.description}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                <span title={formatDateTime(wo.created_at)}>
                  {formatRelative(wo.created_at)}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
    </div>
  )
}
