"use client"

import { useState } from "react"
import { approveComplaint, rejectComplaint } from "@/lib/actions/complaints"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { StatusBadge } from "@/components/shared/status-badge"
import type { Complaint } from "@/lib/types"

export function ComplaintDetailCard({ complaint }: { complaint: Complaint }) {
  const [rejectOpen, setRejectOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const isPending = complaint.status === "pending_review"

  async function handleApprove() {
    setSubmitting(true)
    try {
      await approveComplaint(complaint.id)
    } catch {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold">{complaint.equipment?.name || "Unknown Equipment"}</h3>
          <p className="text-sm text-gray-500">Tag: {complaint.equipment?.tag_number || "-"}</p>
          {complaint.equipment?.department && (
            <p className="text-sm text-gray-500">Department: {complaint.equipment.department}</p>
          )}
          {complaint.equipment?.location && (
            <p className="text-sm text-gray-500">Location: {complaint.equipment.location}</p>
          )}
        </div>
        <StatusBadge status={complaint.status.replace("_", " ")} />
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

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <Label>Reported By</Label>
          <p>{complaint.reported_by_name || "-"}</p>
        </div>
        <div>
          <Label>Department</Label>
          <p>{complaint.reported_by_department || "-"}</p>
        </div>
        <div>
          <Label>Date</Label>
          <p>{new Date(complaint.created_at).toLocaleString()}</p>
        </div>
      </div>

      {isPending && (
        <div className="flex gap-3 border-t pt-4">
          <form action={handleApprove}>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Approving..." : "Approve & Create Work Order"}
            </Button>
          </form>
          <Button
            variant="outline"
            onClick={() => setRejectOpen(!rejectOpen)}
            disabled={submitting}
          >
            Reject
          </Button>
        </div>
      )}

      {rejectOpen && (
        <form action={async (fd) => { await rejectComplaint(complaint.id, fd) }} className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <Label htmlFor="review_notes">Rejection Reason *</Label>
          <Textarea
            id="review_notes"
            name="review_notes"
            required
            minLength={5}
            placeholder="Explain why this complaint is being rejected..."
          />
          <div className="flex gap-3">
            <Button type="submit" variant="destructive">Confirm Rejection</Button>
            <Button type="button" variant="ghost" onClick={() => setRejectOpen(false)}>Cancel</Button>
          </div>
        </form>
      )}

      {!isPending && complaint.review_notes && (
        <div className="rounded-lg border bg-gray-50 p-4">
          <Label>Review Notes</Label>
          <p className="mt-1 text-sm">{complaint.review_notes}</p>
          {complaint.reviewer && (
            <p className="mt-1 text-xs text-gray-500">Reviewed by {complaint.reviewer.full_name}</p>
          )}
        </div>
      )}
    </div>
  )
}
