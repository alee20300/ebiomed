"use client"

import { useState } from "react"
import Link from "next/link"
import { approveComplaint, convertComplaintToWorkOrder, rejectComplaint, triageComplaint } from "@/lib/actions/complaints"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { StatusBadge } from "@/components/shared/status-badge"
import type { Complaint, VisitLog } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { calculateRequestTriage, requestWorkflowStatus } from "@/lib/utils/request-triage"
import { Clock, Mail, Phone, PhoneOff, ShieldAlert } from "lucide-react"

function formatSla(dueAt: string, nowMs: number) {
  const due = new Date(dueAt)
  const diff = due.getTime() - nowMs
  const hours = Math.abs(diff) / (1000 * 60 * 60)
  const label = hours < 1 ? `${Math.max(1, Math.round(hours * 60))}m` : `${Math.round(hours)}h`
  return diff >= 0 ? `${label} remaining` : `${label} overdue`
}

export function ComplaintDetailCard({
  complaint,
  visits,
  duplicateCandidates,
  callLogEnabled,
  canReview = true,
}: {
  complaint: Complaint
  visits: VisitLog[]
  duplicateCandidates?: Complaint[]
  callLogEnabled: boolean
  canReview?: boolean
}) {
  const [rejectOpen, setRejectOpen] = useState(false)
  const [nowMs] = useState(() => Date.now())

  const isPending = complaint.status === "pending_review"
  const isApproved = complaint.status === "approved"
  const isConverted = Boolean(complaint.converted_work_order_id)
  const workflowStatus = requestWorkflowStatus(complaint)
  const isTriaged = workflowStatus === "triaged"
  const triageDecision = calculateRequestTriage({
    urgency: complaint.urgency || "normal",
    patientSafetyRisk: complaint.patient_safety_risk || "none",
    clinicalImpact: complaint.clinical_impact || "routine",
    patientCareCritical: complaint.patient_care_critical || false,
    assetCriticality: complaint.equipment?.asset_criticality,
    submittedAt: new Date(complaint.created_at),
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold">{complaint.equipment?.name || "Unknown Equipment"}</h3>
          <p className="font-mono text-sm text-muted-foreground">{complaint.reference_number}</p>
          <p className="text-sm text-muted-foreground">Tag: {complaint.equipment?.tag_number || "-"}</p>
          {complaint.equipment?.department && (
            <p className="text-sm text-muted-foreground">Department: {complaint.equipment.department}</p>
          )}
          {complaint.equipment?.location && (
            <p className="text-sm text-muted-foreground">Location: {complaint.equipment.location}</p>
          )}
        </div>
        <StatusBadge status={workflowStatus} />
      </div>

      {complaint.photo_url && (
        <div>
          <Label>Fault Photo</Label>
          <img
            src={complaint.photo_url}
            alt="Fault"
            className="mt-1 max-h-64 rounded-lg border object-cover"
          />
        </div>
      )}

      <div>
        <Label>Description</Label>
        <p className="mt-1 text-sm">{complaint.description}</p>
      </div>

      <div className="grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <Label>Reported By</Label>
          <p>{complaint.reported_by_name || "-"}</p>
        </div>
        <div>
          <Label>Department</Label>
          <p>{complaint.reported_by_department || "-"}</p>
        </div>
        <div>
          <Label>Requester Email</Label>
          <p>{complaint.requester_email || "-"}</p>
        </div>
        <div>
          <Label>Date</Label>
          <p>{new Date(complaint.created_at).toLocaleString()}</p>
        </div>
        <div>
          <Label>SLA Review Due</Label>
          <p className={new Date(complaint.sla_due_at).getTime() < nowMs && isPending ? "font-medium text-danger-strong" : ""}>
            {new Date(complaint.sla_due_at).toLocaleString()} · {formatSla(complaint.sla_due_at, nowMs)}
          </p>
        </div>
      </div>

      <div className="rounded-lg border bg-muted p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Label>Triage</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="outline">Urgency: {complaint.urgency || "normal"}</Badge>
              <Badge variant="outline">Safety: {complaint.patient_safety_risk || "none"}</Badge>
              <Badge variant="outline">Impact: {(complaint.clinical_impact || "routine").replaceAll("_", " ")}</Badge>
              {complaint.patient_care_critical && <Badge variant="destructive">Patient care critical</Badge>}
            </div>
          </div>
          <Badge variant={triageDecision.workOrderPriority === "critical" ? "destructive" : triageDecision.workOrderPriority === "high" ? "warning" : "default"}>
            WO priority: {triageDecision.workOrderPriority}
          </Badge>
        </div>
        <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Response Due</p>
            <p>{new Date(complaint.sla_response_due_at || triageDecision.responseDueAt).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Resolution Due</p>
            <p>{new Date(complaint.sla_resolution_due_at || triageDecision.resolutionDueAt).toLocaleString()}</p>
          </div>
        </div>
        {complaint.triage_notes && <p className="mt-3 text-sm text-foreground">{complaint.triage_notes}</p>}
        {complaint.duplicate_of && (
          <Link href={`/complaints/${complaint.duplicate_of}`} className="mt-3 inline-block text-sm font-medium text-primary hover:text-primary/80">
            Linked duplicate request
          </Link>
        )}
      </div>

      {callLogEnabled && complaint.call_status && (
        <div className="rounded-lg border bg-muted p-4">
          <Label>Call Log</Label>
          <div className="mt-2 flex items-center gap-2 text-sm">
            {complaint.call_status === "informed" || complaint.call_status === "answered" ? (
              <>
                <Phone className="h-4 w-4 text-success-strong" />
                <span><strong>{complaint.answered_by || "Unknown"}</strong> was informed</span>
              </>
            ) : complaint.call_status === "not_called" ? (
              <>
                <PhoneOff className="h-4 w-4 text-muted-foreground" />
                <span>Biomedical department was not called</span>
              </>
            ) : (
              <>
                <PhoneOff className="h-4 w-4 text-warning-strong" />
                <span><strong>{complaint.answered_by || "Selected engineer"}</strong> did not pick up</span>
              </>
            )}
          </div>
        </div>
      )}

      {callLogEnabled && visits.length > 0 && (
        <div className="rounded-lg border bg-muted p-4">
          <Label>Site Visits</Label>
          <div className="mt-2 space-y-2">
            {visits.map((visit) => (
              <div key={visit.id} className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-primary" />
                <span>
                  {visit.visited_profile?.full_name || "Engineer"}
                  {" — "}
                  {new Date(visit.visited_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {canReview && isPending && (
        <div className="space-y-3 border-t pt-4">
          {workflowStatus === "new" && (
            <form action={triageComplaint.bind(null, complaint.id)} className="space-y-4 rounded-lg border bg-muted p-4">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-warning-strong" />
                <Label>Biomedical Triage</Label>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label htmlFor="urgency">Urgency</Label>
                  <Select name="urgency" defaultValue={complaint.urgency || "normal"}>
                    <SelectTrigger id="urgency" className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="emergency">Emergency</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="patient_safety_risk">Safety Risk</Label>
                  <Select name="patient_safety_risk" defaultValue={complaint.patient_safety_risk || "none"}>
                    <SelectTrigger id="patient_safety_risk" className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="clinical_impact">Clinical Impact</Label>
                  <Select name="clinical_impact" defaultValue={complaint.clinical_impact || "routine"}>
                    <SelectTrigger id="clinical_impact" className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="routine">Routine</SelectItem>
                      <SelectItem value="care_delayed">Care Delayed</SelectItem>
                      <SelectItem value="patient_at_risk">Patient At Risk</SelectItem>
                      <SelectItem value="patient_harm">Patient Harm</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="patient_care_critical" name="patient_care_critical" defaultChecked={complaint.patient_care_critical} />
                <Label htmlFor="patient_care_critical">Patient care depends on this device</Label>
              </div>
              <div className="space-y-1">
                <Label htmlFor="duplicate_of">Duplicate Of</Label>
                <Select name="duplicate_of" defaultValue={complaint.duplicate_of || "none"}>
                  <SelectTrigger id="duplicate_of" className="w-full"><SelectValue placeholder="No duplicate selected" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No duplicate selected</SelectItem>
                    {(duplicateCandidates || []).map((candidate) => (
                      <SelectItem key={candidate.id} value={candidate.id}>
                        {candidate.reference_number} · {new Date(candidate.created_at).toLocaleDateString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(duplicateCandidates || []).length > 0 && (
                  <p className="text-xs text-muted-foreground">Recent open requests exist for the same equipment.</p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="triage_notes">Triage Notes *</Label>
                <Textarea
                  id="triage_notes"
                  name="triage_notes"
                  required
                  minLength={5}
                  defaultValue={complaint.triage_notes || ""}
                  placeholder="Document clinical risk, duplicate decision, and expected response..."
                />
              </div>
              <Button type="submit" className="w-full sm:w-auto">
                Save Triage
              </Button>
            </form>
          )}
          {isTriaged && (
            <form action={approveComplaint.bind(null, complaint.id)} className="space-y-3 rounded-lg border bg-muted p-4">
              <Label htmlFor="approve_notes">Approval Notes</Label>
              <Textarea
                id="approve_notes"
                name="review_notes"
                placeholder="Add optional approval context for the requester and department..."
              />
              <Button type="submit" className="w-full sm:w-auto">
                Approve Request
              </Button>
            </form>
          )}
          <Button
            variant="outline"
            onClick={() => setRejectOpen(!rejectOpen)}
            className="w-full sm:w-auto"
          >
            Reject
          </Button>
        </div>
      )}

      {canReview && isApproved && !isConverted && (
        <form action={convertComplaintToWorkOrder.bind(null, complaint.id)} className="rounded-lg border border-info bg-info-subtle p-4">
          <Label>Conversion</Label>
          <p className="mt-1 text-sm text-info-strong">This approved request is ready to become a corrective work order.</p>
          <Button type="submit" className="mt-3 w-full sm:w-auto">
            Convert to Work Order
          </Button>
        </form>
      )}

      {isConverted && complaint.converted_work_order_id && (
        <div className="rounded-lg border bg-muted p-4">
          <Label>Work Order</Label>
          <p className="mt-1 text-sm">
            Converted {complaint.converted_at ? new Date(complaint.converted_at).toLocaleString() : ""}
          </p>
          <Link href={`/work-orders/${complaint.converted_work_order_id}`} className="mt-2 inline-block text-sm font-medium text-primary hover:text-primary/80">
            Open work order
          </Link>
        </div>
      )}

      {rejectOpen && (
        <form action={async (fd) => { await rejectComplaint(complaint.id, fd) }} className="space-y-3 rounded-lg border border-danger bg-danger-subtle p-4">
          <Label htmlFor="review_notes">Rejection Reason *</Label>
          <Textarea
            id="review_notes"
            name="review_notes"
            required
            minLength={5}
            placeholder="Explain why this complaint is being rejected..."
          />
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="submit" variant="destructive" className="w-full sm:w-auto">Confirm Rejection</Button>
            <Button type="button" variant="ghost" onClick={() => setRejectOpen(false)} className="w-full sm:w-auto">Cancel</Button>
          </div>
        </form>
      )}

      {!isPending && complaint.review_notes && (
        <div className="rounded-lg border bg-muted p-4">
          <Label>Review Notes</Label>
          <p className="mt-1 text-sm">{complaint.review_notes}</p>
          {complaint.reviewer && (
            <p className="mt-1 text-xs text-muted-foreground">Reviewed by {complaint.reviewer.full_name}</p>
          )}
        </div>
      )}

      {complaint.notifications && complaint.notifications.length > 0 && (
        <div className="rounded-lg border bg-muted p-4">
          <Label>Status Notifications</Label>
          <div className="mt-3 space-y-3">
            {complaint.notifications
              .slice()
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              .map((notification) => (
                <div key={notification.id} className="flex gap-3 text-sm">
                  <Mail className="mt-0.5 h-4 w-4 text-primary" />
                  <div>
                    <p>{notification.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(notification.created_at).toLocaleString()}
                      {notification.recipient_email ? ` · ${notification.recipient_email}` : ""}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
