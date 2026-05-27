"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { logAudit } from "@/lib/actions/audit"
import type { ChecklistTemplate, ChecklistSubmission } from "@/lib/types"

export async function getChecklistTemplates(equipmentId: string): Promise<ChecklistTemplate[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("checklist_templates")
    .select("*")
    .eq("equipment_id", equipmentId)
    .eq("active", true)
    .order("created_at", { ascending: true })

  return (data || []) as unknown as ChecklistTemplate[]
}

export async function getAllTemplates(): Promise<ChecklistTemplate[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("checklist_templates")
    .select("*, equipment:equipment_id(name, tag_number)")
    .order("created_at", { ascending: false })

  return (data || []) as unknown as ChecklistTemplate[]
}

export async function getEquipmentByTag(tagNumber: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from("equipment")
    .select("*")
    .eq("tag_number", tagNumber)
    .single()

  return data
}

export async function getChecklistSubmissions(equipmentId: string): Promise<ChecklistSubmission[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("checklist_submissions")
    .select("*, template:template_id(name), equipment:equipment_id(name,tag_number)")
    .eq("equipment_id", equipmentId)
    .order("created_at", { ascending: false })
    .limit(50)

  return (data || []) as unknown as ChecklistSubmission[]
}

export async function submitChecklist(formData: FormData) {
  const supabase = await createClient()

  const equipmentId = formData.get("equipment_id") as string
  const templateId = formData.get("template_id") as string
  const itemsRaw = formData.get("items") as string
  const notes = (formData.get("notes") as string) || null
  const submittedBy = (formData.get("submitted_by_name") as string) || null
  const department = (formData.get("submitted_by_department") as string) || null

  if (!equipmentId || !itemsRaw) {
    return redirect("/checklist?error=Missing required fields")
  }

  let items: Array<{ id: string; text: string; status: "ok" | "not_ok" }>
  try {
    items = JSON.parse(itemsRaw)
  } catch {
    return redirect("/checklist?error=Invalid checklist data")
  }

  if (items.length === 0) {
    return redirect("/checklist?error=No checklist items submitted")
  }

  const failedItems = items.filter((i) => i.status === "not_ok")

  let workOrderId: string | null = null

  if (failedItems.length > 0) {
    const { data: equipment } = await supabase
      .from("equipment")
      .select("name")
      .eq("id", equipmentId)
      .single()

    const { data: template } = templateId
      ? await supabase.from("checklist_templates").select("name").eq("id", templateId).single()
      : null

    const failedList = failedItems.map((i) => `- ${i.text}`).join("\n")
    const templateLabel = template ? ` (${template.name})` : ""
    const description = `End-user checklist failed${templateLabel} for ${equipment?.name || "equipment"}:\n${failedList}`

    const { data: wo } = await supabase
      .from("work_orders")
      .insert({
        equipment_id: equipmentId,
        type: "corrective",
        priority: "medium",
        status: "open",
        description,
        reported_by_name: submittedBy,
        reported_by_department: department,
      })
      .select()
      .single()

    if (wo) workOrderId = wo.id
  }

  const { data: submission, error } = await supabase.from("checklist_submissions").insert({
    equipment_id: equipmentId,
    template_id: templateId || null,
    items,
    notes,
    submitted_by_name: submittedBy,
    submitted_by_department: department,
    work_order_id: workOrderId,
  }).select().single()

  if (error) {
    return redirect(`/checklist?error=${encodeURIComponent(error.message)}`)
  }

  await logAudit("checklist_submissions", submission.id, "insert", [
    { newValue: JSON.stringify({ equipment_id: equipmentId, template_id: templateId, has_failed_items: failedItems.length > 0 }) }
  ], notes || "Checklist submitted")

  if (workOrderId) {
    await logAudit("work_orders", workOrderId, "insert", [
      { newValue: JSON.stringify({ equipment_id: equipmentId, type: "corrective", status: "open", reason: "Auto-created from failed checklist items" }) }
    ], "Auto-created from failed checklist #" + submission.id)
  }

  revalidatePath(`/equipment/${equipmentId}`)
  revalidatePath("/dashboard")
  redirect("/checklist/success")
}

export async function saveChecklistTemplate(formData: FormData) {
  const supabase = await createClient()

  const equipmentId = formData.get("equipment_id") as string
  const name = formData.get("name") as string
  const itemsRaw = (formData.get("items") as string) || ""
  const frequency = (formData.get("frequency") as string) || "daily"
  const templateId = formData.get("template_id") as string

  if (!equipmentId || !name) {
    return redirect(`/equipment/${equipmentId}?edit=1&error=${encodeURIComponent("Template name is required")}`)
  }

  const items = itemsRaw
    .split("\n")
    .map((text, index) => ({ id: `check-${index}`, text: text.trim() }))
    .filter((item) => item.text.length > 0)

  if (templateId) {
    const { error } = await supabase
      .from("checklist_templates")
      .update({ name, items, frequency })
      .eq("id", templateId)

    if (error) {
      return redirect(`/equipment/${equipmentId}?edit=1&error=${encodeURIComponent(error.message)}`)
    }

    await logAudit("checklist_templates", templateId, "update", [
      { newValue: JSON.stringify({ name, frequency }) }
    ], "Template updated")
  } else {
    const { data, error } = await supabase
      .from("checklist_templates")
      .insert({ equipment_id: equipmentId, name, items, frequency })
      .select().single()

    if (error) {
      return redirect(`/equipment/${equipmentId}?edit=1&error=${encodeURIComponent(error.message)}`)
    }

    await logAudit("checklist_templates", data.id, "insert", [
      { newValue: JSON.stringify({ equipment_id: equipmentId, name, frequency }) }
    ], "Template created")
  }

  revalidatePath(`/equipment/${equipmentId}`)
  redirect(`/equipment/${equipmentId}?edit=1`)
}

export async function deleteChecklistTemplate(templateId: string, equipmentId: string) {
  const supabase = await createClient()
  await supabase.from("checklist_templates").delete().eq("id", templateId)

  await logAudit("checklist_templates", templateId, "delete", [
    { field: "deleted", oldValue: templateId }
  ], "Template deleted")

  revalidatePath(`/equipment/${equipmentId}`)
  redirect(`/equipment/${equipmentId}?edit=1`)
}
