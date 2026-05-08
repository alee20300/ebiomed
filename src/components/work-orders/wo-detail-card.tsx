"use client"

import { useSearchParams } from "next/navigation"
import { updateWorkOrderStatus } from "@/lib/actions/work-orders"
import { StatusBadge } from "@/components/shared/status-badge"
import { PriorityBadge } from "@/components/shared/priority-badge"
import { formatDateTime } from "@/lib/utils/format"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { AlertCircle } from "lucide-react"
import type { WorkOrder } from "@/lib/types"

interface Props {
  workOrder: WorkOrder
}

export function WorkOrderDetailCard({ workOrder }: Props) {
  const searchParams = useSearchParams()
  const error = searchParams.get("error")

  const isComplete = workOrder.status === "completed" || workOrder.status === "cancelled"

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-sm font-medium text-gray-500">Equipment</p>
          <p>{workOrder.equipment?.name} ({workOrder.equipment?.tag_number})</p>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500">Type</p>
          <p className="capitalize">{workOrder.type}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500">Priority</p>
          <PriorityBadge priority={workOrder.priority} />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500">Status</p>
          <StatusBadge status={workOrder.status} />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500">Assigned To</p>
          <p>{workOrder.assigned_profile?.full_name || "Unassigned"}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500">Created By</p>
          <p>{workOrder.created_profile?.full_name}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500">Created</p>
          <p>{formatDateTime(workOrder.created_at)}</p>
        </div>
        {workOrder.started_at && (
          <div>
            <p className="text-sm font-medium text-gray-500">Started</p>
            <p>{formatDateTime(workOrder.started_at)}</p>
          </div>
        )}
        {workOrder.completed_at && (
          <div>
            <p className="text-sm font-medium text-gray-500">Completed</p>
            <p>{formatDateTime(workOrder.completed_at)}</p>
          </div>
        )}
      </div>

      <div>
        <p className="text-sm font-medium text-gray-500">Description</p>
        <p className="whitespace-pre-wrap">{workOrder.description}</p>
      </div>

      {workOrder.resolution_notes && (
        <div>
          <p className="text-sm font-medium text-gray-500">Resolution</p>
          <p className="whitespace-pre-wrap">{workOrder.resolution_notes}</p>
        </div>
      )}

      {!isComplete && (
        <form className="space-y-4 rounded-lg border bg-gray-50 p-4">
          <h4 className="font-medium">Update Status</h4>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="status">New Status</Label>
              <Select name="status">
                <SelectTrigger><SelectValue placeholder="Select status..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="resolution_notes">Resolution Notes</Label>
            <Textarea id="resolution_notes" name="resolution_notes" rows={3} />
          </div>
          <Button formAction={updateWorkOrderStatus.bind(null, workOrder.id)} type="submit">
            Update
          </Button>
        </form>
      )}
    </div>
  )
}
