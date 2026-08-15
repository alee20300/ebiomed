"use server"

import { createClient } from "@/lib/supabase/server"
import type { PMEngineRun } from "@/lib/types"

export interface PMDashboardData {
  dueSoon: Array<{ id: string; due_at: string; equipment: string; department: string; schedule: string; status: string; workOrderId: string | null }>
  overdue: Array<{ id: string; due_at: string; equipment: string; department: string; schedule: string; escalation: string; status: string; workOrderId: string | null }>
  missedByDepartment: Array<{ department: string; missed: number }>
  generatedWorkOrders: Array<{ id: string; created_at: string; equipment: string; status: string; schedule: string }>
  engineRuns: PMEngineRun[]
  compliancePercent: number
}

export async function getPMDashboardData(nowIso = new Date().toISOString()): Promise<PMDashboardData> {
  const supabase = await createClient()
  const now = new Date(nowIso)
  const soon = new Date(now)
  soon.setUTCDate(soon.getUTCDate() + 14)

  const { data: occurrences } = await supabase
    .from("pm_occurrences")
    .select("id, due_at, status, missed_at, escalation_level, work_order_id, schedule:pm_schedule_id(description), equipment:equipment_id(name, tag_number, department)")
    .order("due_at", { ascending: true })
    .limit(200)

  const { data: generatedWos } = await supabase
    .from("work_orders")
    .select("id, created_at, status, schedule:pm_schedule_id(description), equipment:equipment_id(name, tag_number)")
    .eq("type", "preventive")
    .not("pm_schedule_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(10)

  const { data: engineRuns } = await supabase
    .from("pm_engine_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(10)

  const rows = (occurrences || []) as unknown as Array<{
    id: string
    due_at: string
    status: string
    missed_at: string | null
    escalation_level: string
    work_order_id: string | null
    schedule: { description: string | null } | null
    equipment: { name: string; tag_number: string; department: string | null } | null
  }>

  const dueSoon = rows
    .filter((row) => {
      const dueAt = new Date(row.due_at)
      return ["due", "generated"].includes(row.status) && dueAt >= now && dueAt <= soon
    })
    .slice(0, 8)
    .map((row) => ({
      id: row.id,
      due_at: row.due_at,
      equipment: row.equipment ? `${row.equipment.name} (${row.equipment.tag_number})` : "Unknown",
      department: row.equipment?.department || "Unassigned",
      schedule: row.schedule?.description || "PM schedule",
      status: row.status,
      workOrderId: row.work_order_id,
    }))

  const overdue = rows
    .filter((row) => ["due", "generated", "missed"].includes(row.status) && new Date(row.due_at) < now)
    .slice(0, 8)
    .map((row) => ({
      id: row.id,
      due_at: row.due_at,
      equipment: row.equipment ? `${row.equipment.name} (${row.equipment.tag_number})` : "Unknown",
      department: row.equipment?.department || "Unassigned",
      schedule: row.schedule?.description || "PM schedule",
      escalation: row.escalation_level,
      status: row.status,
      workOrderId: row.work_order_id,
    }))

  const dueForCompliance = rows.filter((row) => new Date(row.due_at) <= now)
  const completed = dueForCompliance.filter((row) => row.status === "completed" && !row.missed_at).length
  const compliancePercent = dueForCompliance.length ? Math.round((completed / dueForCompliance.length) * 100) : 0

  const missedMap = new Map<string, number>()
  for (const row of rows.filter((item) => item.status === "missed")) {
    const dept = row.equipment?.department || "Unassigned"
    missedMap.set(dept, (missedMap.get(dept) || 0) + 1)
  }

  return {
    dueSoon,
    overdue,
    missedByDepartment: Array.from(missedMap.entries()).map(([department, missed]) => ({ department, missed })),
    generatedWorkOrders: ((generatedWos || []) as unknown as Array<{
      id: string
      created_at: string
      status: string
      schedule: { description: string | null } | null
      equipment: { name: string; tag_number: string } | null
    }>).map((wo) => ({
      id: wo.id,
      created_at: wo.created_at,
      status: wo.status,
      equipment: wo.equipment ? `${wo.equipment.name} (${wo.equipment.tag_number})` : "Unknown",
      schedule: wo.schedule?.description || "PM schedule",
    })),
    engineRuns: (engineRuns || []) as PMEngineRun[],
    compliancePercent,
  }
}
