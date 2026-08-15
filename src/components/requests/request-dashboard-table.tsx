"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { StatusBadge } from "@/components/shared/status-badge"
import { ListControls, matchesQuery, paginate } from "@/components/shared/list-controls"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import type { Complaint } from "@/lib/types"
import { requestWorkflowStatus } from "@/lib/utils/request-triage"

function statusLabel(complaint: Complaint) {
  return requestWorkflowStatus(complaint)
}

function slaBadge(complaint: Complaint, dueAt = complaint.sla_response_due_at || complaint.sla_due_at) {
  const workflowStatus = requestWorkflowStatus(complaint)
  if (workflowStatus === "converted") return <Badge variant="info">Converted</Badge>
  if (workflowStatus === "approved") return <Badge variant="success">Approved</Badge>
  if (workflowStatus === "rejected") return <Badge variant="destructive">Rejected</Badge>
  const overdue = new Date(dueAt).getTime() < Date.now()
  return <Badge variant={overdue ? "destructive" : "warning"}>{overdue ? "SLA overdue" : "SLA active"}</Badge>
}

export function RequestDashboardTable({ requests }: { requests: Complaint[] }) {
  const pageSize = 10
  const [filter, setFilter] = useState("all")
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  const filteredRequests = useMemo(() => requests.filter((request) => {
    const status = statusLabel(request)
    const matchesFilter =
      filter === "all" ||
      status === filter ||
      request.urgency === filter ||
      request.patient_safety_risk === filter

    return matchesFilter && matchesQuery([
      request.reference_number,
      request.equipment?.name,
      request.equipment?.tag_number,
      request.reported_by_department,
      request.description,
    ], query)
  }), [filter, query, requests])
  const pageData = paginate(filteredRequests, page, pageSize)
  const filters = [
    { value: "all", label: "All" },
    { value: "new", label: "New" },
    { value: "triaged", label: "Triaged" },
    { value: "approved", label: "Approved" },
    { value: "converted", label: "Converted" },
    { value: "emergency", label: "Emergency" },
    { value: "critical", label: "Critical Safety" },
  ]

  if (requests.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No submitted requests for your department.</p>
  }

  return (
    <div className="space-y-3">
      <ListControls
        filters={filters}
        activeFilter={filter}
        onFilterChange={setFilter}
        query={query}
        onQueryChange={setQuery}
        searchPlaceholder="Search requests"
        page={pageData.page}
        totalPages={pageData.totalPages}
        totalItems={filteredRequests.length}
        pageSize={pageSize}
        onPageChange={setPage}
      />
      <div className="space-y-3 md:hidden">
        {pageData.items.map((request) => (
          <article key={request.id} className="rounded-lg border bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-xs text-muted-foreground">{request.reference_number}</p>
                <h3 className="truncate font-semibold">{request.equipment?.name || "Unknown Equipment"}</h3>
                <p className="text-sm text-muted-foreground">{request.reported_by_department || request.equipment?.department || "-"}</p>
              </div>
              <StatusBadge status={statusLabel(request)} />
            </div>
            <p className="mt-3 line-clamp-2 text-sm">{request.description}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="outline">Urgency: {request.urgency || "normal"}</Badge>
              <Badge variant="outline">Safety: {request.patient_safety_risk || "none"}</Badge>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              {slaBadge(request)}
              <Link href={`/complaints/${request.id}`} className="text-sm font-medium text-primary hover:text-primary/80">
                View
              </Link>
            </div>
          </article>
        ))}
      </div>

      <Table className="hidden md:table">
        <TableHeader>
          <TableRow>
            <TableHead>Reference</TableHead>
            <TableHead>Equipment</TableHead>
            <TableHead>Department</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Risk</TableHead>
            <TableHead>SLA</TableHead>
            <TableHead>Submitted</TableHead>
            <TableHead>Description</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageData.items.map((request) => (
            <TableRow key={request.id}>
              <TableCell>
                <Link href={`/complaints/${request.id}`} className="font-mono text-xs text-primary hover:underline">
                  {request.reference_number}
                </Link>
              </TableCell>
              <TableCell>{request.equipment?.name || "Unknown"}</TableCell>
              <TableCell>{request.reported_by_department || request.equipment?.department || "-"}</TableCell>
              <TableCell><StatusBadge status={statusLabel(request)} /></TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  <Badge variant="outline">{request.urgency || "normal"}</Badge>
                  <span className="text-xs text-muted-foreground">Safety: {request.patient_safety_risk || "none"}</span>
                </div>
              </TableCell>
              <TableCell>{slaBadge(request)}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{new Date(request.created_at).toLocaleDateString()}</TableCell>
              <TableCell className="max-w-xs truncate text-sm">{request.description}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
