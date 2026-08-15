"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/lib/actions/profiles"
import { logAudit } from "@/lib/actions/audit"
import { requirePermission } from "@/lib/actions/permissions"

export async function bulkUpdateEquipment(formData: FormData) {
  const user = await getCurrentUser()
  if (!user) return redirect("/dashboard")
  await requirePermission({ action: "write", resource: "equipment" }, "/settings")

  const tags = String(formData.get("tag_numbers") || "")
    .split(/[\n,]/)
    .map((tag) => tag.trim())
    .filter(Boolean)
  if (tags.length === 0) return redirect(`/settings?error=${encodeURIComponent("At least one tag number is required")}`)

  const updates: Record<string, string> = {}
  for (const field of ["department", "location", "status"] as const) {
    const value = String(formData.get(field) || "").trim()
    if (value) updates[field] = value
  }
  const assignedPm = String(formData.get("assigned_pm") || "").trim()
  if (Object.keys(updates).length === 0 && !assignedPm) {
    return redirect(`/settings?error=${encodeURIComponent("Choose at least one bulk update value")}`)
  }

  const supabase = await createClient()
  let updatedEquipmentIds: string[] = []
  if (Object.keys(updates).length > 0) {
    const { data, error } = await supabase
      .schema("ebiomed")
      .from("equipment")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .in("tag_number", tags)
      .select("id")
    if (error) return redirect(`/settings?error=${encodeURIComponent(error.message)}`)
    updatedEquipmentIds = (data || []).map((row) => row.id)
  } else {
    const { data, error } = await supabase
      .schema("ebiomed")
      .from("equipment")
      .select("id")
      .in("tag_number", tags)
    if (error) return redirect(`/settings?error=${encodeURIComponent(error.message)}`)
    updatedEquipmentIds = (data || []).map((row) => row.id)
  }

  if (assignedPm && updatedEquipmentIds.length > 0) {
    const { error } = await supabase
      .schema("ebiomed")
      .from("pm_schedules")
      .update({ assigned_to: assignedPm, updated_at: new Date().toISOString() })
      .in("equipment_id", updatedEquipmentIds)
    if (error) return redirect(`/settings?error=${encodeURIComponent(error.message)}`)
  }

  await logAudit("equipment", updatedEquipmentIds[0] || "00000000-0000-0000-0000-000000000000", "update", [
    { newValue: JSON.stringify({ tags, updates, assignedPm: assignedPm || null, count: updatedEquipmentIds.length }) },
  ], "Bulk equipment update")

  revalidatePath("/settings")
  revalidatePath("/equipment")
  revalidatePath("/pm-schedules")
  redirect("/settings")
}
