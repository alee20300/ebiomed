"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { partSchema, partsUsageSchema } from "@/lib/schemas/parts"
import { getCurrentUser } from "@/lib/actions/profiles"
import { logAudit } from "@/lib/actions/audit"
import type { Part } from "@/lib/types"

export async function createPart(formData: FormData) {
  const supabase = await createClient()
  const raw = Object.fromEntries(formData)
  const parsed = partSchema.safeParse(raw)

  if (!parsed.success) {
    const messages = parsed.error.errors.map((e) => e.message).join(", ")
    return redirect(`/parts?error=${encodeURIComponent(messages)}`)
  }

  const { data, error } = await supabase.from("parts").insert(parsed.data).select().single()
  if (error) {
    return redirect(`/parts?error=${encodeURIComponent(error.message)}`)
  }

  await logAudit("parts", data.id, "insert", [
    { newValue: JSON.stringify(parsed.data) }
  ], parsed.data.reason)

  revalidatePath("/parts")
  revalidatePath("/dashboard")
  redirect("/parts")
}

export async function getParts(): Promise<Part[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("parts")
    .select("*")
    .order("name")

  return (data || []) as Part[]
}

export async function restockPart(formData: FormData) {
  const supabase = await createClient()
  const raw = Object.fromEntries(formData)

  const { data: part, error: fetchError } = await supabase
    .from("parts")
    .select("quantity_on_hand")
    .eq("id", raw.id as string)
    .single()

  if (fetchError || !part) {
    return redirect("/parts?error=Part not found")
  }

  const newQuantity = part.quantity_on_hand + parseInt(raw.quantity as string, 10)

  const { error } = await supabase
    .from("parts")
    .update({ quantity_on_hand: newQuantity, updated_at: new Date().toISOString() })
    .eq("id", raw.id as string)

  if (error) {
    return redirect(`/parts?error=${encodeURIComponent(error.message)}`)
  }

  await logAudit("parts", raw.id as string, "update", [
    { field: "quantity_on_hand", oldValue: String(part.quantity_on_hand), newValue: String(newQuantity) }
  ], (raw.reason as string) || "Restock")

  revalidatePath("/parts")
  redirect("/parts")
}

export async function consumeParts(formData: FormData) {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) return redirect("/login")

  const raw = Object.fromEntries(formData)
  const parsed = partsUsageSchema.safeParse(raw)

  if (!parsed.success) {
    const messages = parsed.error.errors.map((e) => e.message).join(", ")
    return redirect(`/work-orders/${raw.work_order_id}?error=${encodeURIComponent(messages)}`)
  }

  const { data, error } = await supabase.from("parts_usage").insert({
    ...parsed.data,
    used_by: user.id,
  }).select().single()

  if (error) {
    return redirect(`/work-orders/${raw.work_order_id}?error=${encodeURIComponent(error.message)}`)
  }

  await logAudit("parts_usage", data.id, "insert", [
    { newValue: JSON.stringify({ work_order_id: parsed.data.work_order_id, part_id: parsed.data.part_id, quantity_used: parsed.data.quantity_used }) }
  ], parsed.data.reason)

  revalidatePath("/parts")
  revalidatePath(`/work-orders/${raw.work_order_id}`)
  redirect(`/work-orders/${raw.work_order_id}`)
}
