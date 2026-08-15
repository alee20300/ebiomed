"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { StatusBadge } from "@/components/shared/status-badge"
import { formatDate } from "@/lib/utils/format"
import { ListControls, matchesQuery, paginate } from "@/components/shared/list-controls"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { ResponsiveTableFrame } from "@/components/shared/responsive-table-frame"
import type { Equipment } from "@/lib/types"

interface Props {
  data: Equipment[]
}

export function EquipmentTable({ data }: Props) {
  const pageSize = 15
  const [filter, setFilter] = useState("all")
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  const filteredData = useMemo(() => data.filter((equip) => {
    const matchesFilter =
      filter === "all" ||
      equip.status === filter ||
      equip.asset_criticality === filter

    return matchesFilter && matchesQuery([
      equip.tag_number,
      equip.name,
      equip.manufacturer,
      equip.model,
      equip.department,
      equip.location,
      equip.serial_number,
    ], query)
  }), [data, filter, query])
  const pageData = paginate(filteredData, page, pageSize)
  const filters = [
    { value: "all", label: "All" },
    { value: "active", label: "Active" },
    { value: "under_repair", label: "Repair" },
    { value: "out_of_tolerance", label: "Tolerance" },
    { value: "inactive", label: "Inactive" },
    { value: "life_support", label: "Life Support" },
    { value: "high", label: "High Criticality" },
  ]

  if (data.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-8 text-center text-muted-foreground">
        No equipment found. Create your first equipment entry.
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
      searchPlaceholder="Search equipment"
      page={pageData.page}
      totalPages={pageData.totalPages}
      totalItems={filteredData.length}
      pageSize={pageSize}
      onPageChange={setPage}
    />
    <div className="grid gap-3 md:hidden">
      {pageData.items.map((equip) => (
        <Link
          key={equip.id}
          href={`/equipment/${equip.id}`}
          className="rounded-lg border bg-white p-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium text-primary">{equip.tag_number}</p>
              <p className="truncate text-sm font-medium">{equip.name}</p>
              <p className="text-xs text-muted-foreground">{equip.department || "Unassigned"} · {equip.location || "No location"}</p>
            </div>
            <StatusBadge status={equip.status} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div>
              <span className="block uppercase">Criticality</span>
              <span className="capitalize text-foreground">{equip.asset_criticality?.replaceAll("_", " ") || "—"}</span>
            </div>
            <div>
              <span className="block uppercase">Installed</span>
              <span className="text-foreground">{formatDate(equip.install_date)}</span>
            </div>
          </div>
        </Link>
      ))}
    </div>
    <ResponsiveTableFrame className="hidden md:block">
      <Table className="min-w-[840px]">
        <TableHeader>
          <TableRow>
            <TableHead>Tag #</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Manufacturer</TableHead>
            <TableHead>Criticality</TableHead>
            <TableHead>Department</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Installed</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageData.items.map((equip) => (
            <TableRow key={equip.id}>
              <TableCell>
                <Link
                  href={`/equipment/${equip.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {equip.tag_number}
                </Link>
              </TableCell>
              <TableCell>{equip.name}</TableCell>
              <TableCell>{equip.manufacturer || "—"}</TableCell>
              <TableCell className="capitalize">{equip.asset_criticality?.replaceAll("_", " ") || "—"}</TableCell>
              <TableCell>{equip.department || "—"}</TableCell>
              <TableCell>{equip.location || "—"}</TableCell>
              <TableCell>
                <StatusBadge status={equip.status} />
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDate(equip.install_date)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ResponsiveTableFrame>
    </div>
  )
}
