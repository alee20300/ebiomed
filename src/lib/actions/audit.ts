"use server"

import { createClient } from "@/lib/supabase/server"

export async function logAudit(
  tableName: string,
  recordId: string,
  action: "insert" | "update" | "delete",
  changes: Array<{
    field?: string
    oldValue?: string | null
    newValue?: string | null
  }>,
  reason: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const entries = changes.map((change) => ({
    p_table_name: tableName,
    p_record_id: recordId,
    p_action: action,
    p_field_name: change.field || null,
    p_old_value: change.oldValue || null,
    p_new_value: change.newValue || null,
    p_reason: reason,
  }))

  for (const entry of entries) {
    await supabase.rpc("insert_audit_entry", entry)
  }
}

export async function getAuditLog(params: {
  tableName?: string
  recordId?: string
  userId?: string
  action?: string
  limit?: number
  offset?: number
}) {
  const supabase = await createClient()

  let query = supabase
    .from("audit_log")
    .select("*, profile:changed_by(full_name, role)")
    .order("changed_at", { ascending: false })

  if (params.tableName) {
    query = query.eq("table_name", params.tableName)
  }
  if (params.recordId) {
    query = query.eq("record_id", params.recordId)
  }
  if (params.userId) {
    query = query.eq("changed_by", params.userId)
  }
  if (params.action) {
    query = query.eq("action", params.action)
  }

  query = query.range(
    params.offset || 0,
    (params.offset || 0) + (params.limit || 50) - 1
  )

  const { data, error, count } = await query

  if (error) {
    throw new Error(`Failed to fetch audit log: ${error.message}`)
  }

  return { entries: data || [], count: count || 0 }
}

export async function getAuditLogForRecord(
  tableName: string,
  recordId: string
) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("audit_log")
    .select("*, profile:changed_by(full_name, role)")
    .eq("table_name", tableName)
    .eq("record_id", recordId)
    .order("changed_at", { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch audit log: ${error.message}`)
  }

  return data || []
}

export async function exportAuditLog(params: {
  tableName?: string
  recordId?: string
  userId?: string
  action?: string
}) {
  const supabase = await createClient()

  let query = supabase
    .from("audit_log")
    .select("*, profile:changed_by(full_name, role)")
    .order("changed_at", { ascending: false })

  if (params.tableName) {
    query = query.eq("table_name", params.tableName)
  }
  if (params.recordId) {
    query = query.eq("record_id", params.recordId)
  }
  if (params.userId) {
    query = query.eq("changed_by", params.userId)
  }
  if (params.action) {
    query = query.eq("action", params.action)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to export audit log: ${error.message}`)
  }

  return data || []
}
