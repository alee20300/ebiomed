"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { assetDocumentSchema, equipmentSchema } from "@/lib/schemas/equipment"
import { logAudit } from "@/lib/actions/audit"
import { getCurrentUser } from "@/lib/actions/profiles"
import { requirePermission } from "@/lib/actions/permissions"
import { recordSignature, verifyPassword } from "@/lib/actions/signatures"
import type { AssetDocument, Equipment } from "@/lib/types"
import { buildAssetLifecycleSnapshot } from "@/lib/utils/asset-lifecycle"

const ASSET_DOCUMENT_BUCKET = "asset-documents"

function normalizeNullableFields<T extends Record<string, unknown>>(data: T) {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, value === "" ? null : value])
  ) as T
}

export async function createEquipment(formData: FormData) {
  const supabase = await createClient()
  await requirePermission({ action: "write", resource: "equipment" }, "/equipment/new")
  const raw = Object.fromEntries(formData)

  const parsed = equipmentSchema.safeParse(raw)
  if (!parsed.success) {
    const messages = parsed.error.issues.map((e) => e.message).join(", ")
    return redirect(`/equipment/new?error=${encodeURIComponent(messages)}`)
  }

  const { reason, parent_id, ...equipmentData } = parsed.data
  const payload = normalizeNullableFields(equipmentData)

  if (payload.lifecycle_stage === "in_service" && payload.commissioning_status !== "approved_for_service") {
    return redirect(`/equipment/new?error=${encodeURIComponent("Create the asset in commissioning, then approve commissioning before moving it into service")}`)
  }

  const { data, error } = await supabase.from("equipment").insert({
    ...payload,
    parent_id: parent_id || null,
  }).select().single()

  if (error) {
    return redirect(`/equipment/new?error=${encodeURIComponent(error.message)}`)
  }

  await logAudit("equipment", data.id, "insert", [
    { newValue: JSON.stringify(payload) }
  ], reason)

  revalidatePath("/equipment")
  redirect("/equipment")
}

export async function updateEquipment(id: string, formData: FormData) {
  const supabase = await createClient()
  await requirePermission({ action: "write", resource: "equipment" }, `/equipment/${id}`)
  const raw = Object.fromEntries(formData)

  const parsed = equipmentSchema.partial().safeParse(raw)
  if (!parsed.success) {
    const messages = parsed.error.issues.map((e) => e.message).join(", ")
    return redirect(`/equipment/${id}?error=${encodeURIComponent(messages)}`)
  }

  const { reason, parent_id, ...equipmentData } = parsed.data
  const payload = normalizeNullableFields(equipmentData)

  const { data: current } = await supabase
    .from("equipment")
    .select("status, lifecycle_stage, commissioning_status, decommissioning_status")
    .eq("id", id)
    .single()

  if (
    payload.lifecycle_stage === "in_service" &&
    current?.lifecycle_stage !== "in_service" &&
    current?.commissioning_status !== "approved_for_service"
  ) {
    return redirect(`/equipment/${id}?error=${encodeURIComponent("Commissioning approval is required before moving an asset into service")}`)
  }

  const retiringAsset =
    (payload.status === "retired" && current?.status !== "retired") ||
    (payload.lifecycle_stage === "retired" && current?.lifecycle_stage !== "retired")

  if (retiringAsset) {
    await requirePermission({ action: "retire", resource: "equipment" }, `/equipment/${id}`)
    if (current?.decommissioning_status !== "completed") {
      return redirect(`/equipment/${id}?error=${encodeURIComponent("Complete the decommissioning workflow before retiring this asset")}`)
    }
    const password = String(raw.reauth_password || "")
    const verified = password.length > 0 && await verifyPassword(password)
    if (!verified) {
      return redirect(`/equipment/${id}?error=${encodeURIComponent("Re-authentication is required to retire an asset")}`)
    }
  }

  const { error } = await supabase
    .from("equipment")
    .update({
      ...payload,
      parent_id: parent_id || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)

  if (error) {
    return redirect(`/equipment/${id}?error=${encodeURIComponent(error.message)}`)
  }

  await logAudit("equipment", id, "update", [
    { newValue: JSON.stringify(payload) }
  ], reason || "Equipment updated")

  if (retiringAsset) {
    await recordSignature("equipment", id, "Reviewed", reason || "Asset retired")
  }

  revalidatePath("/equipment")
  revalidatePath(`/equipment/${id}`)
  redirect(`/equipment/${id}`)
}

export async function getEquipment(): Promise<Equipment[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("equipment")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) return []
  return data as Equipment[]
}

export async function getEquipmentById(id: string): Promise<Equipment | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("equipment")
    .select("*")
    .eq("id", id)
    .single()

  if (error) return null
  return data as Equipment
}

export async function getEquipmentServiceSummary(equipmentId: string) {
  const supabase = await createClient()

  const { data: workOrders } = await supabase
    .schema("ebiomed")
    .from("work_orders")
    .select("id, status, downtime_minutes")
    .eq("equipment_id", equipmentId)
    .is("deleted_at", null)

  const workOrderIds = (workOrders || []).map((wo) => wo.id)
  if (workOrderIds.length === 0) {
    return { workOrderCount: 0, completedCount: 0, openCount: 0, downtimeMinutes: 0, serviceCost: 0 }
  }

  const { data: jobCards } = await supabase
    .schema("ebiomed")
    .from("job_cards")
    .select("id, expenses:job_card_expenses(amount), parts:job_card_parts(quantity_used, part:part_id(unit_cost))")
    .in("work_order_id", workOrderIds)

  const serviceCost = ((jobCards || []) as unknown as Array<{
    expenses?: Array<{ amount: number | string | null }>
    parts?: Array<{ quantity_used: number | string | null; part?: { unit_cost: number | string | null } | Array<{ unit_cost: number | string | null }> | null }>
  }>).reduce((sum, card) => {
    const expenses = (card.expenses || []).reduce((total, expense) => total + Number(expense.amount || 0), 0)
    const parts = (card.parts || []).reduce((total, part) => {
      const joinedPart = Array.isArray(part.part) ? part.part[0] : part.part
      return total + Number(part.quantity_used || 0) * Number(joinedPart?.unit_cost || 0)
    }, 0)
    return sum + expenses + parts
  }, 0)

  return {
    workOrderCount: workOrders?.length || 0,
    completedCount: workOrders?.filter((wo) => wo.status === "completed").length || 0,
    openCount: workOrders?.filter((wo) => wo.status !== "completed" && wo.status !== "cancelled").length || 0,
    downtimeMinutes: workOrders?.reduce((sum, wo) => sum + Number(wo.downtime_minutes || 0), 0) || 0,
    serviceCost,
  }
}

export async function refreshEquipmentLifecycle(equipmentId: string) {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) return redirect("/login")
  await requirePermission({ action: "lifecycle", resource: "equipment" }, `/equipment/${equipmentId}`)

  const { data: equipment } = await supabase
    .from("equipment")
    .select("*")
    .eq("id", equipmentId)
    .single()

  if (!equipment) {
    return redirect(`/equipment?error=${encodeURIComponent("Equipment not found")}`)
  }

  const serviceSummary = await getEquipmentServiceSummary(equipmentId)
  const snapshot = buildAssetLifecycleSnapshot(equipment as Equipment, serviceSummary)

  const { error } = await supabase
    .from("equipment")
    .update({
      ...snapshot,
      updated_at: new Date().toISOString(),
    })
    .eq("id", equipmentId)

  if (error) {
    return redirect(`/equipment/${equipmentId}?error=${encodeURIComponent(error.message)}`)
  }

  await logAudit("equipment", equipmentId, "update", [
    { field: "lifecycle_risk_score", oldValue: equipment.lifecycle_risk_score ? String(equipment.lifecycle_risk_score) : null, newValue: String(snapshot.lifecycle_risk_score) },
    { field: "replacement_recommendation", oldValue: equipment.replacement_recommendation || null, newValue: snapshot.replacement_recommendation },
  ], "Refreshed asset lifecycle rollup")

  revalidatePath("/equipment")
  revalidatePath(`/equipment/${equipmentId}`)
  redirect(`/equipment/${equipmentId}`)
}

export async function getAssetDocuments(equipmentId: string): Promise<AssetDocument[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .schema("ebiomed")
    .from("asset_documents")
    .select("*, uploader:uploaded_by(full_name, role)")
    .eq("equipment_id", equipmentId)
    .order("created_at", { ascending: false })

  return (data || []) as unknown as AssetDocument[]
}

export async function uploadAssetDocument(equipmentId: string, formData: FormData) {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) return redirect("/login")
  await requirePermission({ action: "documents", resource: "equipment" }, `/equipment/${equipmentId}`)

  const parsed = assetDocumentSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return redirect(`/equipment/${equipmentId}?error=${encodeURIComponent(parsed.error.issues.map((e) => e.message).join(", "))}`)
  }

  const file = formData.get("file") as File | null
  if (!file || file.size === 0) {
    return redirect(`/equipment/${equipmentId}?error=${encodeURIComponent("Document file is required")}`)
  }

  const extension = file.name.split(".").pop()?.toLowerCase() || "bin"
  const path = `${equipmentId}/${crypto.randomUUID()}.${extension}`
  const { error: uploadError } = await supabase.storage
    .from(ASSET_DOCUMENT_BUCKET)
    .upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    })

  if (uploadError) {
    return redirect(`/equipment/${equipmentId}?error=${encodeURIComponent(uploadError.message)}`)
  }

  const { data: urlData } = supabase.storage.from(ASSET_DOCUMENT_BUCKET).getPublicUrl(path)

  const { data, error } = await supabase
    .schema("ebiomed")
    .from("asset_documents")
    .insert({
      equipment_id: equipmentId,
      document_type: parsed.data.document_type,
      title: parsed.data.title,
      file_url: urlData.publicUrl,
      file_name: file.name,
      mime_type: file.type || null,
      expires_at: parsed.data.expires_at || null,
      retention_policy: parsed.data.retention_policy,
      retain_until: parsed.data.retain_until || null,
      legal_hold: parsed.data.legal_hold,
      legal_hold_reason: parsed.data.legal_hold_reason || null,
      uploaded_by: user.id,
    })
    .select("id")
    .single()

  if (error) {
    return redirect(`/equipment/${equipmentId}?error=${encodeURIComponent(error.message)}`)
  }

  await logAudit("asset_documents", data.id, "insert", [
    { newValue: JSON.stringify({ equipment_id: equipmentId, document_type: parsed.data.document_type, title: parsed.data.title }) }
  ], `Uploaded asset document: ${parsed.data.title}`)

  revalidatePath(`/equipment/${equipmentId}`)
  redirect(`/equipment/${equipmentId}`)
}
