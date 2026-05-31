"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/lib/actions/profiles"
import { logAudit } from "@/lib/actions/audit"
import { jobCardCompleteSchema, jobCardEntrySchema, jobCardPartSchema } from "@/lib/schemas/job-card"
import type { JobCard } from "@/lib/types"

export async function createJobCard(workOrderId: string) {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) return redirect("/login")

  const { data, error } = await supabase
    .schema("ebiomed")
    .from("job_cards")
    .insert({
      work_order_id: workOrderId,
      technician_id: user.id,
      status: "in_progress",
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  await logAudit("job_cards", data.id, "insert", [
    { newValue: JSON.stringify({ work_order_id: workOrderId, technician_id: user.id }) }
  ], "Job card started")

  revalidatePath(`/work-orders/${workOrderId}`)
}

export async function completeJobCard(id: string, formData: FormData) {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) return redirect("/login")

  const raw = Object.fromEntries(formData)
  const parsed = jobCardCompleteSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(", "))
  }

  const { data: jc, error } = await supabase
    .schema("ebiomed")
    .from("job_cards")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      summary: parsed.data.summary,
      unresolved_issues: parsed.data.unresolved_issues || null,
    })
    .eq("id", id)
    .select("work_order_id")
    .single()

  if (error) throw new Error(error.message)

  await logAudit("job_cards", id, "update", [
    { field: "status", oldValue: "in_progress", newValue: "completed" },
  ], "Job card completed")

  revalidatePath(`/work-orders/${jc.work_order_id}`)
}

export async function getJobCards(workOrderId: string): Promise<JobCard[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .schema("ebiomed")
    .from("job_cards")
    .select("*, technician:technician_id(full_name), entries:job_card_entries(*), parts:job_card_parts(*, part:part_id(name)), expenses:job_card_expenses(*)")
    .eq("work_order_id", workOrderId)
    .order("created_at", { ascending: false })

  return (data || []) as unknown as JobCard[]
}

export async function addJobCardEntry(jobCardId: string, formData: FormData) {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) return redirect("/login")

  const raw = Object.fromEntries(formData)
  const parsed = jobCardEntrySchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(", "))
  }

  const started = new Date(parsed.data.started_at)
  const ended = new Date(parsed.data.ended_at)
  const durationMinutes = Math.round((ended.getTime() - started.getTime()) / 60000)

  const { error } = await supabase
    .schema("ebiomed")
    .from("job_card_entries")
    .insert({
      job_card_id: jobCardId,
      description: parsed.data.description,
      started_at: parsed.data.started_at,
      ended_at: parsed.data.ended_at,
      duration_minutes: durationMinutes,
    })

  if (error) throw new Error(error.message)

  const { data: jc } = await supabase
    .schema("ebiomed")
    .from("job_cards")
    .select("work_order_id")
    .eq("id", jobCardId)
    .single()

  revalidatePath(`/work-orders/${jc?.work_order_id}`)
}

export async function addJobCardPart(jobCardId: string, formData: FormData) {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) return redirect("/login")

  const raw = Object.fromEntries(formData)
  const parsed = jobCardPartSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(", "))
  }

  const { error } = await supabase
    .schema("ebiomed")
    .from("job_card_parts")
    .insert({
      job_card_id: jobCardId,
      part_id: parsed.data.part_id,
      quantity_used: parsed.data.quantity_used,
    })

  if (error) throw new Error(error.message)

  const { data: jc } = await supabase
    .schema("ebiomed")
    .from("job_cards")
    .select("work_order_id")
    .eq("id", jobCardId)
    .single()

  revalidatePath(`/work-orders/${jc?.work_order_id}`)
}
