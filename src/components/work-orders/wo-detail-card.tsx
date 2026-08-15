"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { updateWorkOrderStatus } from "@/lib/actions/work-orders"
import { getSignatures } from "@/lib/actions/signatures"
import { StatusBadge } from "@/components/shared/status-badge"
import { PriorityBadge } from "@/components/shared/priority-badge"
import { formatDateTime } from "@/lib/utils/format"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { AlertCircle, CheckCircle2, Circle } from "lucide-react"
import { PartsUsageForm } from "@/components/work-orders/parts-usage-form"
import { ReAuthDialog } from "@/components/shared/reauth-dialog"
import { ReasonForChange } from "@/components/shared/reason-for-change"
import { SignatureBlock } from "@/components/shared/signature-block"
import { getWorkOrderCloseoutRequirements, type WorkOrderCloseoutRequirement } from "@/lib/utils/work-order-lifecycle"
import { enqueueOfflineDraft, type WorkOrderStatusDraftPayload } from "@/lib/offline/work-order-drafts"
import type { WorkOrder, Signature } from "@/lib/types"

interface Props {
  workOrder: WorkOrder
  closeoutStatus: {
    timeEntryCount: number
    requirements: WorkOrderCloseoutRequirement[]
  }
}

type PartsUsageRow = {
  quantity_used: number
  used_at: string
  part: { name: string } | { name: string }[] | null
}

export function WorkOrderDetailCard({ workOrder, closeoutStatus }: Props) {
  const [technicians, setTechnicians] = useState<Array<{ id: string; full_name: string; role: string }>>([])
  const [partsUsed, setPartsUsed] = useState<Array<{ part_name: string; quantity_used: number; used_at: string }>>([])
  const [signatures, setSignatures] = useState<Signature[]>([])
  const [status, setStatus] = useState("")
  const [assignedTo, setAssignedTo] = useState(workOrder.assigned_to || "")
  const [resolutionNotes, setResolutionNotes] = useState(workOrder.resolution_notes || "")
  const [reason, setReason] = useState("")
  const [reasonError, setReasonError] = useState("")
  const [reauthOpen, setReauthOpen] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState("")
  const supabase = createClient()

  useEffect(() => {
    supabase
      .schema("ebiomed")
      .from("profiles")
      .select("id, full_name, role")
      .in("role", ["technician", "admin"])
      .order("full_name")
      .then(({ data }) => setTechnicians((data as Array<{ id: string; full_name: string; role: string }>) || []))

    supabase
      .schema("ebiomed")
      .from("parts_usage")
      .select("quantity_used, used_at, part:part_id(name)")
      .eq("work_order_id", workOrder.id)
      .order("used_at", { ascending: false })
      .then(({ data }) => {
        const rows = (data || []) as PartsUsageRow[]
        setPartsUsed(rows.map((row) => ({
          part_name: Array.isArray(row.part) ? row.part[0]?.name || "Unknown part" : row.part?.name || "Unknown part",
          quantity_used: row.quantity_used,
          used_at: row.used_at,
        })))
      })

    getSignatures("work_order", workOrder.id).then((data) => setSignatures(data as Signature[]))
  }, [workOrder.id, supabase])

  const isComplete = workOrder.status === "completed" || workOrder.status === "cancelled"

  const needsReauth = status === "completed" || status === "cancelled"
  const completionRequirements = getWorkOrderCloseoutRequirements({
    resolutionNotes,
    timeEntryCount: closeoutStatus.timeEntryCount,
    signatureReason: reason,
    reauthVerified: false,
  })

  const handleUpdateClick = (e: React.FormEvent) => {
    e.preventDefault()

    if (!status) return
    if (!reason || reason.length < 5) {
      setReasonError("Reason for change is required (min 5 characters)")
      return
    }
    setReasonError("")

    if (status === "completed") {
      const missingBeforeReauth = completionRequirements.filter((requirement) => (
        requirement.id !== "reauth" && !requirement.met
      ))
      if (missingBeforeReauth.length > 0) {
        setError(missingBeforeReauth.map((requirement) => requirement.message).join(" "))
        return
      }
    }

    if (needsReauth) {
      setReauthOpen(true)
    } else {
      executeUpdate()
    }
  }

  const executeUpdate = async (reauthPassword?: string) => {
    setUpdating(true)
    setError("")
    const draftPayload: WorkOrderStatusDraftPayload = {
      workOrderId: workOrder.id,
      status,
      assignedTo: assignedTo || null,
      resolutionNotes: resolutionNotes || null,
      reason,
      originalStatus: workOrder.status,
      originalAssignedTo: workOrder.assigned_to || null,
    }

    if (!navigator.onLine) {
      await enqueueOfflineDraft("work_order_status", workOrder.id, draftPayload)
      setError("Offline draft saved. It will stay queued until you reconnect and retry sync.")
      setUpdating(false)
      return
    }

    try {
      const formData = new FormData()
      formData.set("status", status)
      formData.set("assigned_to", assignedTo)
      formData.set("resolution_notes", resolutionNotes)
      formData.set("reason", reason)
      if (reauthPassword) formData.set("reauth_password", reauthPassword)

      await updateWorkOrderStatus(workOrder.id, formData)
    } catch {
      if (!navigator.onLine) {
        await enqueueOfflineDraft("work_order_status", workOrder.id, draftPayload)
        setError("Offline draft saved. It will stay queued until you reconnect and retry sync.")
      } else {
        setError("Failed to update status. Please try again.")
      }
    }
    setUpdating(false)
  }

  const handleReauthSuccess = (reauthPassword: string) => {
    setReauthOpen(false)
    executeUpdate(reauthPassword)
  }

  const handleReauthCancel = () => {
    setReauthOpen(false)
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-center gap-2 rounded-md border border-danger bg-danger-subtle p-3 text-sm text-danger-strong">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Equipment</p>
          <p>{workOrder.equipment?.name} ({workOrder.equipment?.tag_number})</p>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Type</p>
          <p className="capitalize">{workOrder.type}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Priority</p>
          <PriorityBadge priority={workOrder.priority} />
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Status</p>
          <StatusBadge status={workOrder.status} />
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Assigned To</p>
          <p>{workOrder.assigned_profile?.full_name || "Unassigned"}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Created By</p>
          <p>{workOrder.created_profile?.full_name}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Created</p>
          <p>{formatDateTime(workOrder.created_at)}</p>
        </div>
        {workOrder.started_at && (
          <div>
            <p className="text-sm font-medium text-muted-foreground">Started</p>
            <p>{formatDateTime(workOrder.started_at)}</p>
          </div>
        )}
        {workOrder.completed_at && (
          <div>
            <p className="text-sm font-medium text-muted-foreground">Completed</p>
            <p>{formatDateTime(workOrder.completed_at)}</p>
          </div>
        )}
        {workOrder.downtime_minutes !== null && workOrder.downtime_minutes !== undefined && (
          <div>
            <p className="text-sm font-medium text-muted-foreground">Downtime</p>
            <p>{workOrder.downtime_minutes} minutes</p>
          </div>
        )}
      </div>

      <div>
        <p className="text-sm font-medium text-muted-foreground">Description</p>
        <p className="whitespace-pre-wrap">{workOrder.description}</p>
      </div>

      {workOrder.resolution_notes && (
        <div>
          <p className="text-sm font-medium text-muted-foreground">Resolution</p>
          <p className="whitespace-pre-wrap">{workOrder.resolution_notes}</p>
        </div>
      )}

      {partsUsed.length > 0 && (
        <div>
          <p className="text-sm font-medium text-muted-foreground">Parts Used</p>
          <div className="mt-1 space-y-1">
            {partsUsed.map((pu, index) => (
              <div key={index} className="flex items-center gap-2 text-sm">
                <span className="font-medium">{pu.part_name}</span>
                <span className="text-muted-foreground">× {pu.quantity_used}</span>
                <span className="ml-auto text-xs text-muted-foreground">{formatDateTime(pu.used_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isComplete && (
        <form onSubmit={handleUpdateClick} className="space-y-4 rounded-lg border bg-muted p-4">
          <h4 className="font-medium">Update Status</h4>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="status">New Status</Label>
              <Select value={status} onValueChange={(value) => setStatus(value || "")}>
                <SelectTrigger><SelectValue placeholder="Select status..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="assigned_to">Assign To</Label>
              <Select value={assignedTo} onValueChange={(value) => setAssignedTo(value || "")}>
                <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Unassigned</SelectItem>
                  {technicians.map((tech) => (
                    <SelectItem key={tech.id} value={tech.id}>
                      {tech.full_name} ({tech.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="resolution_notes">Resolution Notes</Label>
            <Textarea
              id="resolution_notes"
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              rows={3}
            />
          </div>
          {status === "completed" && (
            <div className="space-y-2 rounded-md border bg-white p-3">
              <p className="text-sm font-medium">Completion Requirements</p>
              <div className="space-y-1">
                {completionRequirements.map((requirement) => (
                  <div
                    key={requirement.id}
                    className="flex items-start gap-2 text-sm"
                  >
                    {requirement.met ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success-strong" />
                    ) : (
                      <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className={requirement.met ? "text-foreground" : "text-muted-foreground"}>
                      {requirement.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <ReasonForChange
            value={reason}
            onChange={setReason}
            error={reasonError}
          />
          <Button type="submit" disabled={updating}>
            {updating ? "Updating..." : "Update"}
          </Button>
        </form>
      )}

      {!isComplete && (
        <div className="space-y-3 rounded-lg border bg-muted p-4">
          <h4 className="font-medium">Log Parts Used</h4>
          <PartsUsageForm workOrderId={workOrder.id} />
        </div>
      )}

      {signatures.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Electronic Signatures</h4>
          <SignatureBlock signatures={signatures} compact />
        </div>
      )}

      <ReAuthDialog
        open={reauthOpen}
        onOpenChange={setReauthOpen}
        actionLabel={`Work Order #${workOrder.id.slice(0, 8)} — Mark as ${status}`}
        meaning={status === "completed" ? "Verified" : "Reviewed"}
        onSuccess={handleReauthSuccess}
        onCancel={handleReauthCancel}
      />
    </div>
  )
}
