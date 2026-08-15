import type { WorkOrder } from "@/lib/types"

export type WorkOrderStatus = WorkOrder["status"]

export interface WorkOrderCloseoutEvidence {
  resolutionNotes?: string | null
  timeEntryCount: number
  signatureReason?: string | null
  reauthVerified: boolean
}

export interface WorkOrderCloseoutRequirement {
  id: "resolution_notes" | "time_entry" | "reauth" | "signature_reason"
  label: string
  met: boolean
  message: string
}

const validTransitions: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  open: ["in_progress", "on_hold", "cancelled"],
  in_progress: ["on_hold", "completed", "cancelled"],
  on_hold: ["in_progress", "cancelled"],
  completed: [],
  cancelled: [],
}

export function requiresWorkOrderReauth(status: WorkOrderStatus | undefined): boolean {
  return status === "completed" || status === "cancelled"
}

export function validateWorkOrderStatusTransition(
  currentStatus: WorkOrderStatus,
  newStatus: WorkOrderStatus | undefined
): { valid: true } | { valid: false; message: string } {
  if (!newStatus) return { valid: true }

  if (currentStatus === "completed" || currentStatus === "cancelled") {
    return { valid: false, message: "Cannot modify a completed or cancelled work order" }
  }

  if (!validTransitions[currentStatus]?.includes(newStatus)) {
    return {
      valid: false,
      message: `Invalid status transition from ${currentStatus} to ${newStatus}`,
    }
  }

  return { valid: true }
}

export function getWorkOrderCloseoutRequirements(
  evidence: WorkOrderCloseoutEvidence
): WorkOrderCloseoutRequirement[] {
  return [
    {
      id: "resolution_notes",
      label: "Resolution notes",
      met: !!evidence.resolutionNotes?.trim(),
      message: "Resolution notes are required before completion.",
    },
    {
      id: "time_entry",
      label: "Time entry",
      met: evidence.timeEntryCount > 0,
      message: "At least one job-card time entry is required before completion.",
    },
    {
      id: "reauth",
      label: "Re-authentication",
      met: evidence.reauthVerified,
      message: "Re-authentication is required before completion.",
    },
    {
      id: "signature_reason",
      label: "Signature reason",
      met: !!evidence.signatureReason?.trim(),
      message: "A signature reason is required before completion.",
    },
  ]
}

export function validateWorkOrderCloseout(
  evidence: WorkOrderCloseoutEvidence
): { valid: true } | { valid: false; messages: string[] } {
  const messages = getWorkOrderCloseoutRequirements(evidence)
    .filter((requirement) => !requirement.met)
    .map((requirement) => requirement.message)

  return messages.length === 0 ? { valid: true } : { valid: false, messages }
}
