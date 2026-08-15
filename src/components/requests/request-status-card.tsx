"use client"

import Link from "next/link"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { StatusBadge } from "@/components/shared/status-badge"
import type { Complaint } from "@/lib/types"
import { requestWorkflowStatus } from "@/lib/utils/request-triage"

function requestStage(complaint: Complaint) {
  const status = requestWorkflowStatus(complaint)
  return status === "converted" ? "converted to work order" : status
}

function slaVariant(complaint: Complaint, nowMs: number) {
  const status = requestWorkflowStatus(complaint)
  if (!["new", "triaged"].includes(status)) return "default"
  return new Date(complaint.sla_response_due_at || complaint.sla_due_at).getTime() < nowMs ? "destructive" : "warning"
}

export function RequestStatusCard({ complaint, publicView = false }: { complaint: Complaint; publicView?: boolean }) {
  const [nowMs] = useState(() => Date.now())
  const notifications = (complaint.notifications || [])
    .slice()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return (
    <div className="space-y-6 rounded-lg border bg-white p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-mono text-sm text-muted-foreground">{complaint.reference_number}</p>
          <h1 className="mt-1 text-2xl font-bold text-foreground">{complaint.equipment?.name || "Request"}</h1>
          <p className="text-sm text-muted-foreground">
            {complaint.equipment?.tag_number || "No tag"} · {complaint.equipment?.department || complaint.reported_by_department || "No department"}
          </p>
        </div>
        <StatusBadge status={requestStage(complaint)} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-muted p-3">
          <p className="text-xs font-medium uppercase text-muted-foreground">Submitted</p>
          <p className="mt-1 text-sm">{new Date(complaint.created_at).toLocaleString()}</p>
        </div>
        <div className="rounded-lg border bg-muted p-3">
          <p className="text-xs font-medium uppercase text-muted-foreground">Response SLA</p>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant={slaVariant(complaint, nowMs)}>
              {new Date(complaint.sla_response_due_at || complaint.sla_due_at).getTime() < nowMs && ["new", "triaged"].includes(requestWorkflowStatus(complaint)) ? "Overdue" : "On track"}
            </Badge>
          </div>
          <p className="mt-1 text-sm">{new Date(complaint.sla_response_due_at || complaint.sla_due_at).toLocaleString()}</p>
        </div>
        <div className="rounded-lg border bg-muted p-3">
          <p className="text-xs font-medium uppercase text-muted-foreground">Department</p>
          <p className="mt-1 text-sm">{complaint.reported_by_department || complaint.equipment?.department || "-"}</p>
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-foreground">Issue</p>
        <p className="mt-1 text-sm text-foreground">{complaint.description}</p>
      </div>

      {complaint.triaged_at && (
        <div className="rounded-lg border bg-muted p-3">
          <p className="text-sm font-medium text-foreground">Biomedical Triage</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="outline">Urgency: {complaint.urgency}</Badge>
            <Badge variant="outline">Safety: {complaint.patient_safety_risk}</Badge>
            <Badge variant="outline">Impact: {complaint.clinical_impact.replaceAll("_", " ")}</Badge>
          </div>
          {complaint.sla_resolution_due_at && (
            <p className="mt-2 text-sm text-foreground">Resolution target: {new Date(complaint.sla_resolution_due_at).toLocaleString()}</p>
          )}
        </div>
      )}

      {complaint.review_notes && (
        <div className="rounded-lg border bg-muted p-3">
          <p className="text-sm font-medium text-foreground">Review Notes</p>
          <p className="mt-1 text-sm text-foreground">{complaint.review_notes}</p>
        </div>
      )}

      {complaint.converted_work_order_id && (
        <div className="rounded-lg border border-info bg-info-subtle p-3">
          <p className="text-sm font-medium text-info-strong">Work Order Created</p>
          <p className="mt-1 text-sm text-info-strong">
            The biomedical team converted this request to a corrective work order.
          </p>
          {!publicView && (
            <Link href={`/work-orders/${complaint.converted_work_order_id}`} className="mt-2 inline-block text-sm font-medium text-primary hover:text-info-strong">
              Open work order
            </Link>
          )}
        </div>
      )}

      <div>
        <p className="text-sm font-medium text-foreground">Status History</p>
        <div className="mt-3 space-y-3">
          {notifications.length > 0 ? notifications.map((notification) => (
            <div key={notification.id} className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-3">
                <Badge variant="outline">{notification.event}</Badge>
                <span className="text-xs text-muted-foreground">{new Date(notification.created_at).toLocaleString()}</span>
              </div>
              <p className="mt-2 text-sm text-foreground">{notification.message}</p>
            </div>
          )) : (
            <p className="rounded-lg border p-3 text-sm text-muted-foreground">No status changes recorded yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}
