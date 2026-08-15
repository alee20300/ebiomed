"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { startPMTask } from "@/lib/actions/pm-schedules"
import { getPMStatus, formatDate } from "@/lib/utils/format"
import { statusColor } from "@/lib/utils/format"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ResponsiveTableFrame } from "@/components/shared/responsive-table-frame"
import { ListControls, matchesQuery, paginate } from "@/components/shared/list-controls"
import type { PMSchedule } from "@/lib/types"

interface Props {
  data: PMSchedule[]
}

export function PMTable({ data }: Props) {
  const pageSize = 15
  const [filter, setFilter] = useState("active")
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  const filteredData = useMemo(() => data.filter((pm) => {
    const status = getPMStatus(pm.next_due)
    const matchesFilter =
      filter === "all" ||
      (filter === "active" && pm.active) ||
      (filter === "inactive" && !pm.active) ||
      status === filter ||
      pm.equipment?.asset_criticality === filter

    return matchesFilter && matchesQuery([
      pm.equipment?.name,
      pm.equipment?.tag_number,
      pm.equipment?.department,
      pm.equipment?.location,
      pm.description,
      pm.frequency_days,
    ], query)
  }), [data, filter, query])
  const pageData = paginate(filteredData, page, pageSize)
  const filters = [
    { value: "active", label: "Active" },
    { value: "all", label: "All" },
    { value: "overdue", label: "Overdue" },
    { value: "due", label: "Due Today" },
    { value: "upcoming", label: "Upcoming" },
    { value: "life_support", label: "Life Support" },
    { value: "inactive", label: "Inactive" },
  ]

  if (data.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-8 text-center text-muted-foreground">
        No PM schedules found.
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
        searchPlaceholder="Search PM schedules"
        page={pageData.page}
        totalPages={pageData.totalPages}
        totalItems={filteredData.length}
        pageSize={pageSize}
        onPageChange={setPage}
      />
    <ResponsiveTableFrame>
      <Table className="min-w-[760px]">
        <TableHeader>
          <TableRow>
            <TableHead>Equipment</TableHead>
            <TableHead>Frequency</TableHead>
            <TableHead>Last Completed</TableHead>
            <TableHead>Next Due</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageData.items.map((pm) => {
            const status = getPMStatus(pm.next_due)
            return (
              <TableRow key={pm.id}>
                <TableCell>
                  <Link href={`/pm-schedules/${pm.id}`} className="font-medium text-primary hover:underline">
                    {pm.equipment?.name || "Unknown"}
                  </Link>
                </TableCell>
                <TableCell>Every {pm.frequency_days} days</TableCell>
                <TableCell>{formatDate(pm.last_completed)}</TableCell>
                <TableCell>{formatDate(pm.next_due)}</TableCell>
                <TableCell>
                  <Badge className={statusColor(status)}>
                    {status === "overdue" ? "Overdue" :
                     status === "due" ? "Due Today" :
                     status === "upcoming" ? "Upcoming" : "OK"}
                  </Badge>
                </TableCell>
                <TableCell>
                  {pm.active && status !== "none" && (
                    <form action={startPMTask.bind(null, pm.id)}>
                      <Button size="sm" type="submit">Start PM</Button>
                    </form>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </ResponsiveTableFrame>
    </div>
  )
}
