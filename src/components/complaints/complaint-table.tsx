"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { AlertTriangle, CheckCircle2, Eye } from "lucide-react"
import { approveComplaint } from "@/lib/actions/complaints"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { ListControls, matchesQuery, paginate } from "@/components/shared/list-controls"
import { cn } from "@/lib/utils"
import { formatRelative } from "@/lib/utils/format"
import type { Complaint } from "@/lib/types"

function isSlaOverdue(slaDueAt: string) {
  return new Date(slaDueAt).getTime() < Date.now()
}

export function ComplaintTable({ complaints }: { complaints: Complaint[] }) {
  const pageSize = 10
  const [filter, setFilter] = useState("all")
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  const filteredComplaints = useMemo(() => complaints.filter((complaint) => {
    const overdue = isSlaOverdue(complaint.sla_due_at)
    const matchesFilter =
      filter === "all" ||
      (filter === "overdue" && overdue) ||
      (filter === "due" && !overdue) ||
      complaint.urgency === filter ||
      complaint.patient_safety_risk === filter

    return matchesFilter && matchesQuery([
      complaint.reference_number,
      complaint.equipment?.name,
      complaint.equipment?.tag_number,
      complaint.reported_by_name,
      complaint.reported_by_department,
      complaint.description,
    ], query)
  }), [complaints, filter, query])
  const pageData = paginate(filteredComplaints, page, pageSize)
  const filters = [
    { value: "all", label: "All" },
    { value: "overdue", label: "SLA Overdue" },
    { value: "due", label: "SLA Due" },
    { value: "emergency", label: "Emergency" },
    { value: "critical", label: "Critical Safety" },
  ]

  if (complaints.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No pending complaints.</p>
  }

  return (
    <div className="space-y-3">
      <ListControls
        filters={filters}
        activeFilter={filter}
        onFilterChange={setFilter}
        query={query}
        onQueryChange={setQuery}
        searchPlaceholder="Search review queue"
        page={pageData.page}
        totalPages={pageData.totalPages}
        totalItems={filteredComplaints.length}
        pageSize={pageSize}
        onPageChange={setPage}
      />
      <div className="space-y-3 md:hidden">
        {pageData.items.map((c) => (
          <article key={c.id} className="rounded-lg border bg-card p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-semibold">{c.equipment?.name || "Unknown Equipment"}</h3>
                <p className="font-mono text-xs text-muted-foreground">{c.reference_number}</p>
                <p className="text-sm text-muted-foreground">
                  {c.equipment?.tag_number || "-"} · {c.equipment?.location || c.equipment?.department || "No location"}
                </p>
              </div>
              <Badge variant={isSlaOverdue(c.sla_due_at) ? "destructive" : "warning"}>
                {isSlaOverdue(c.sla_due_at) ? "SLA overdue" : "Pending"}
              </Badge>
            </div>

            <p className="mb-3 line-clamp-3 text-sm">{c.description}</p>

            <div className="mb-4 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div>
                <span className="block font-medium text-foreground">Reported By</span>
                {c.reported_by_name || "-"}
              </div>
              <div>
                <span className="block font-medium text-foreground">Department</span>
                {c.reported_by_department || "-"}
              </div>
              <div className="col-span-2 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                {formatRelative(c.created_at)}
              </div>
              <div className="col-span-2">
                <span className="block font-medium text-foreground">SLA Due</span>
                {new Date(c.sla_due_at).toLocaleString()}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Link
                href={`/complaints/${c.id}`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full")}
              >
                <Eye className="h-4 w-4" />
                Review
              </Link>
              <form action={approveComplaint.bind(null, c.id)}>
                <Button type="submit" size="sm" className="w-full">
                  <CheckCircle2 className="h-4 w-4" />
                  Approve
                </Button>
              </form>
            </div>
          </article>
        ))}
      </div>

      <Table className="hidden md:table">
        <TableHeader>
          <TableRow>
            <TableHead>Equipment</TableHead>
            <TableHead>Tag</TableHead>
            <TableHead>Reference</TableHead>
            <TableHead>Reported By</TableHead>
            <TableHead>Department</TableHead>
            <TableHead>SLA</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Description</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageData.items.map((c) => (
            <TableRow key={c.id}>
              <TableCell>
                <Link href={`/complaints/${c.id}`} className="font-medium text-primary hover:underline">
                  {c.equipment?.name || "Unknown"}
                </Link>
              </TableCell>
              <TableCell className="font-mono text-sm">{c.equipment?.tag_number || "-"}</TableCell>
              <TableCell className="font-mono text-xs">{c.reference_number}</TableCell>
              <TableCell>{c.reported_by_name || "-"}</TableCell>
              <TableCell>{c.reported_by_department || "-"}</TableCell>
              <TableCell>
                <Badge variant={isSlaOverdue(c.sla_due_at) ? "destructive" : "warning"}>
                  {isSlaOverdue(c.sla_due_at) ? "Overdue" : "Due"}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {new Date(c.created_at).toLocaleDateString()}
              </TableCell>
              <TableCell className="max-w-xs truncate text-sm">{c.description}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
