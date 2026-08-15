"use server"

import { createClient } from "@/lib/supabase/server"

export type CaseTimelineKind =
  | "report"
  | "review"
  | "work_order"
  | "field_work"
  | "parts"
  | "evidence"
  | "comment"
  | "closure"

export interface CaseTimelineEvent {
  id: string
  occurredAt: string
  kind: CaseTimelineKind
  title: string
  description?: string | null
  actor?: string | null
  href?: string | null
}

type ProfileRef = { full_name: string } | null

type ComplaintRow = {
  id: string
  reference_number: string
  description: string
  reported_by_name: string | null
  answered_by: string | null
  call_status: string | null
  created_at: string
  triaged_at: string | null
  triage_notes: string | null
  approved_at: string | null
  rejected_at: string | null
  review_notes: string | null
  converted_at: string | null
  converted_work_order_id: string | null
  triaged_profile: ProfileRef
  reviewer: ProfileRef
}

type WorkOrderRow = {
  id: string
  complaint_id: string | null
  status: string
  created_at: string
  started_at: string | null
  completed_at: string | null
  resolution_notes: string | null
  created_profile: ProfileRef
  assigned_profile: ProfileRef
}

function relation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

async function loadCaseTimeline(input: { complaintId?: string; workOrderId?: string }) {
  const supabase = await createClient()
  let complaint: ComplaintRow | null = null
  let workOrder: WorkOrderRow | null = null

  if (input.workOrderId) {
    const { data } = await supabase
      .from("work_orders")
      .select("id, complaint_id, status, created_at, started_at, completed_at, resolution_notes, created_profile:created_by(full_name), assigned_profile:assigned_to(full_name)")
      .eq("id", input.workOrderId)
      .single()
    workOrder = data as unknown as WorkOrderRow | null
  }

  const complaintId = input.complaintId || workOrder?.complaint_id
  if (complaintId) {
    const { data } = await supabase
      .from("complaints")
      .select("id, reference_number, description, reported_by_name, answered_by, call_status, created_at, triaged_at, triage_notes, approved_at, rejected_at, review_notes, converted_at, converted_work_order_id, triaged_profile:triaged_by(full_name), reviewer:reviewer_id(full_name)")
      .eq("id", complaintId)
      .single()
    complaint = data as unknown as ComplaintRow | null
  }

  const workOrderId = input.workOrderId || complaint?.converted_work_order_id
  if (!workOrder && workOrderId) {
    const { data } = await supabase
      .from("work_orders")
      .select("id, complaint_id, status, created_at, started_at, completed_at, resolution_notes, created_profile:created_by(full_name), assigned_profile:assigned_to(full_name)")
      .eq("id", workOrderId)
      .single()
    workOrder = data as unknown as WorkOrderRow | null
  }

  const events: CaseTimelineEvent[] = []

  if (complaint) {
    events.push({
      id: `complaint-${complaint.id}`,
      occurredAt: complaint.created_at,
      kind: "report",
      title: "Complaint reported",
      description: `${complaint.reference_number} · ${complaint.description}`,
      actor: complaint.reported_by_name,
      href: `/complaints/${complaint.id}`,
    })

    if (complaint.call_status) {
      events.push({
        id: `call-${complaint.id}`,
        occurredAt: complaint.created_at,
        kind: "report",
        title: complaint.call_status === "informed" || complaint.call_status === "answered"
          ? "On-call engineer informed"
          : complaint.call_status === "not_called"
            ? "Biomedical team not called"
            : "On-call engineer did not pick up",
        actor: complaint.answered_by,
      })
    }

    if (complaint.triaged_at) {
      events.push({
        id: `triage-${complaint.id}`,
        occurredAt: complaint.triaged_at,
        kind: "review",
        title: "Complaint triaged",
        description: complaint.triage_notes,
        actor: relation(complaint.triaged_profile)?.full_name,
        href: `/complaints/${complaint.id}`,
      })
    }

    if (complaint.approved_at) {
      events.push({
        id: `approved-${complaint.id}`,
        occurredAt: complaint.approved_at,
        kind: "review",
        title: "Complaint approved",
        description: complaint.review_notes,
        actor: relation(complaint.reviewer)?.full_name,
        href: `/complaints/${complaint.id}`,
      })
    }

    if (complaint.rejected_at) {
      events.push({
        id: `rejected-${complaint.id}`,
        occurredAt: complaint.rejected_at,
        kind: "closure",
        title: "Complaint rejected",
        description: complaint.review_notes,
        actor: relation(complaint.reviewer)?.full_name,
        href: `/complaints/${complaint.id}`,
      })
    }
  }

  if (!workOrder) {
    return events.sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime())
  }

  if (complaint?.converted_at) {
    events.push({
      id: `converted-${complaint.id}`,
      occurredAt: complaint.converted_at,
      kind: "work_order",
      title: "Converted to corrective work order",
      description: `Work order ${workOrder.id.slice(0, 8)}`,
      actor: relation(workOrder.created_profile)?.full_name,
      href: `/work-orders/${workOrder.id}`,
    })
  } else {
    events.push({
      id: `work-order-${workOrder.id}`,
      occurredAt: workOrder.created_at,
      kind: "work_order",
      title: "Work order created",
      actor: relation(workOrder.created_profile)?.full_name,
      href: `/work-orders/${workOrder.id}`,
    })
  }

  const [visitsResult, commentsResult, jobCardsResult, partsResult, photosResult, attachmentsResult, auditResult] = await Promise.all([
    complaint
      ? supabase.from("visit_logs").select("id, visited_at, visited_profile:visited_by(full_name)").eq("complaint_id", complaint.id)
      : Promise.resolve({ data: [] }),
    supabase.from("wo_comments").select("id, text, created_at, author:author_id(full_name)").eq("work_order_id", workOrder.id),
    supabase.from("job_cards").select("id, status, started_at, completed_at, summary, technician:technician_id(full_name), entries:job_card_entries(id, description, started_at, duration_minutes)").eq("work_order_id", workOrder.id),
    supabase.from("parts_usage").select("id, quantity_used, used_at, part:part_id(name), user:used_by(full_name)").eq("work_order_id", workOrder.id),
    supabase.from("work_order_photos").select("id, caption, created_at, uploader:uploaded_by(full_name)").eq("work_order_id", workOrder.id),
    supabase.from("work_order_attachments").select("id, caption, file_name, media_type, created_at, uploader:uploaded_by(full_name)").eq("work_order_id", workOrder.id),
    supabase.from("audit_log").select("id, old_value, new_value, changed_at, reason, profile:changed_by(full_name)").eq("table_name", "work_orders").eq("record_id", workOrder.id).eq("field_name", "status"),
  ])

  for (const row of (visitsResult.data || []) as unknown as Array<{ id: string; visited_at: string; visited_profile: ProfileRef }>) {
    events.push({ id: `visit-${row.id}`, occurredAt: row.visited_at, kind: "field_work", title: "Engineer site visit", actor: relation(row.visited_profile)?.full_name })
  }

  for (const row of (auditResult.data || []) as unknown as Array<{ id: string; old_value: string | null; new_value: string | null; changed_at: string; reason: string; profile: ProfileRef }>) {
    events.push({
      id: `status-${row.id}`,
      occurredAt: row.changed_at,
      kind: row.new_value === "completed" || row.new_value === "cancelled" ? "closure" : "work_order",
      title: `Work order ${row.new_value?.replaceAll("_", " ") || "updated"}`,
      description: row.reason,
      actor: relation(row.profile)?.full_name,
      href: `/work-orders/${workOrder.id}`,
    })
  }

  const hasStartedAudit = (auditResult.data || []).some((row) => (row as { new_value?: string }).new_value === "in_progress")
  const hasCompletedAudit = (auditResult.data || []).some((row) => (row as { new_value?: string }).new_value === "completed")
  if (workOrder.started_at && !hasStartedAudit) {
    events.push({ id: `started-${workOrder.id}`, occurredAt: workOrder.started_at, kind: "work_order", title: "Work started", actor: relation(workOrder.assigned_profile)?.full_name, href: `/work-orders/${workOrder.id}` })
  }
  if (workOrder.completed_at && !hasCompletedAudit) {
    events.push({ id: `completed-${workOrder.id}`, occurredAt: workOrder.completed_at, kind: "closure", title: "Work order completed", description: workOrder.resolution_notes, actor: relation(workOrder.assigned_profile)?.full_name, href: `/work-orders/${workOrder.id}` })
  }

  for (const row of (commentsResult.data || []) as unknown as Array<{ id: string; text: string; created_at: string; author: ProfileRef }>) {
    events.push({ id: `comment-${row.id}`, occurredAt: row.created_at, kind: "comment", title: "Comment added", description: row.text, actor: relation(row.author)?.full_name })
  }

  for (const row of (jobCardsResult.data || []) as unknown as Array<{ id: string; started_at: string; completed_at: string | null; summary: string | null; technician: ProfileRef; entries: Array<{ id: string; description: string; started_at: string; duration_minutes: number }> | null }>) {
    const technician = relation(row.technician)?.full_name
    events.push({ id: `job-card-${row.id}`, occurredAt: row.started_at, kind: "field_work", title: "Job card started", actor: technician })
    for (const entry of row.entries || []) {
      events.push({ id: `labour-${entry.id}`, occurredAt: entry.started_at, kind: "field_work", title: `Labour logged · ${entry.duration_minutes} min`, description: entry.description, actor: technician })
    }
    if (row.completed_at) {
      events.push({ id: `job-card-completed-${row.id}`, occurredAt: row.completed_at, kind: "field_work", title: "Job card completed", description: row.summary, actor: technician })
    }
  }

  for (const row of (partsResult.data || []) as unknown as Array<{ id: string; quantity_used: number; used_at: string; part: { name: string } | null; user: ProfileRef }>) {
    events.push({ id: `part-${row.id}`, occurredAt: row.used_at, kind: "parts", title: "Part consumed", description: `${relation(row.part)?.name || "Part"} × ${row.quantity_used}`, actor: relation(row.user)?.full_name })
  }

  for (const row of (photosResult.data || []) as unknown as Array<{ id: string; caption: string | null; created_at: string; uploader: ProfileRef }>) {
    events.push({ id: `photo-${row.id}`, occurredAt: row.created_at, kind: "evidence", title: "Field photo uploaded", description: row.caption, actor: relation(row.uploader)?.full_name })
  }

  for (const row of (attachmentsResult.data || []) as unknown as Array<{ id: string; caption: string | null; file_name: string | null; media_type: string; created_at: string; uploader: ProfileRef }>) {
    events.push({ id: `attachment-${row.id}`, occurredAt: row.created_at, kind: "evidence", title: `${row.media_type === "video" ? "Video" : "Photo"} evidence uploaded`, description: row.caption || row.file_name, actor: relation(row.uploader)?.full_name })
  }

  return events.sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime())
}

export async function getCaseTimelineForComplaint(complaintId: string) {
  return loadCaseTimeline({ complaintId })
}

export async function getCaseTimelineForWorkOrder(workOrderId: string) {
  return loadCaseTimeline({ workOrderId })
}
