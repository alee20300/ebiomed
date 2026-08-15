"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/lib/actions/profiles"
import { logAudit } from "@/lib/actions/audit"
import { requirePermission } from "@/lib/actions/permissions"
import {
  compatibilityRuleMatchesEquipment,
  compatibilityScopeLabel,
  type CompatibilityScope,
  type EquipmentCompatibilityProfile,
} from "@/lib/utils/equipment-parts"

export type SparePartRelationship = "compatible" | "recommended" | "critical"
export type { CompatibilityScope } from "@/lib/utils/equipment-parts"

export interface EquipmentRelatedPart {
  relationshipId: string | null
  relationshipSource: "equipment" | "rule" | "historical"
  relationshipType: SparePartRelationship | "historical"
  scopeType: CompatibilityScope | "historical"
  scopeLabel: string
  recommendedQuantity: number | null
  notes: string | null
  partId: string
  name: string
  partNumber: string | null
  quantityOnHand: number
  minThreshold: number
  stockLocations: Array<{ name: string; code: string; binCode: string | null; quantity: number }>
  supplier: string | null
  totalUsed: number
  usageCount: number
  workOrderCount: number
  lastUsedAt: string | null
  lastWorkOrderId: string | null
  lastWorkOrderDescription: string | null
}

export interface AvailableSparePart {
  id: string
  name: string
  partNumber: string | null
  quantityOnHand: number
}

type StockBalanceRef = {
  quantity_on_hand: number
  bin_code: string | null
  stock_location: { name: string; code: string } | Array<{ name: string; code: string }> | null
}

type PartRef = {
  id: string
  name: string
  part_number: string | null
  quantity_on_hand: number
  min_threshold: number
  supplier: string | null
  balances?: StockBalanceRef[] | null
}

type UsageRecord = {
  workOrderId: string
  quantity: number
  usedAt: string
  part: PartRef
}

function relation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

const partSelect = "id, name, part_number, quantity_on_hand, min_threshold, supplier, balances:part_stock_balances(quantity_on_hand, bin_code, stock_location:stock_location_id(name, code))"

type CompatibilityRuleRow = {
  id: string
  scope_type: Exclude<CompatibilityScope, "equipment">
  manufacturer: string | null
  model: string | null
  device_category: string | null
  relationship_type: SparePartRelationship
  recommended_quantity: number | null
  notes: string | null
  part: PartRef | PartRef[] | null
}

function equipmentPartsUrl(equipmentId: string, error?: string) {
  return `/equipment/${equipmentId}?tab=parts${error ? `&error=${encodeURIComponent(error)}` : ""}`
}

export async function getEquipmentPartsData(equipmentId: string): Promise<{
  parts: EquipmentRelatedPart[]
  availableParts: AvailableSparePart[]
}> {
  const supabase = await createClient()
  const [{ data: equipmentData }, { data: workOrders }, { data: links }, { data: rules }, { data: inventoryParts }] = await Promise.all([
    supabase.from("equipment").select("manufacturer, model, device_category, category").eq("id", equipmentId).single(),
    supabase.from("work_orders").select("id, description, created_at").eq("equipment_id", equipmentId).is("deleted_at", null),
    supabase.from("equipment_spare_parts").select(`id, relationship_type, recommended_quantity, notes, part:part_id(${partSelect})`).eq("equipment_id", equipmentId),
    supabase.from("spare_part_compatibility_rules").select(`id, scope_type, manufacturer, model, device_category, relationship_type, recommended_quantity, notes, part:part_id(${partSelect})`),
    supabase.from("parts").select("id, name, part_number, quantity_on_hand").is("deleted_at", null).order("name"),
  ])

  const equipment = (equipmentData || { manufacturer: null, model: null, device_category: null, category: null }) as EquipmentCompatibilityProfile

  const workOrderRows = (workOrders || []) as Array<{ id: string; description: string; created_at: string }>
  const workOrderIds = workOrderRows.map((workOrder) => workOrder.id)
  const workOrdersById = new Map(workOrderRows.map((workOrder) => [workOrder.id, workOrder]))
  const usageRecords: UsageRecord[] = []

  if (workOrderIds.length > 0) {
    const [partsUsageResult, jobCardsResult] = await Promise.all([
      supabase.from("parts_usage").select(`id, work_order_id, quantity_used, used_at, part:part_id(${partSelect})`).in("work_order_id", workOrderIds),
      supabase.from("job_cards").select(`id, work_order_id, started_at, updated_at, parts:job_card_parts(id, quantity_used, part:part_id(${partSelect}))`).in("work_order_id", workOrderIds),
    ])

    for (const row of (partsUsageResult.data || []) as unknown as Array<{ work_order_id: string; quantity_used: number; used_at: string; part: PartRef | PartRef[] | null }>) {
      const part = relation(row.part)
      if (part) usageRecords.push({ workOrderId: row.work_order_id, quantity: Number(row.quantity_used || 0), usedAt: row.used_at, part })
    }

    for (const card of (jobCardsResult.data || []) as unknown as Array<{ work_order_id: string; started_at: string; updated_at: string; parts: Array<{ quantity_used: number; part: PartRef | PartRef[] | null }> | null }>) {
      for (const row of card.parts || []) {
        const part = relation(row.part)
        if (part) usageRecords.push({ workOrderId: card.work_order_id, quantity: Number(row.quantity_used || 0), usedAt: card.updated_at || card.started_at, part })
      }
    }
  }

  const grouped = new Map<string, {
    part: PartRef
    relationshipId: string | null
    relationshipSource: "equipment" | "rule" | "historical"
    relationshipType: SparePartRelationship | "historical"
    scopeType: CompatibilityScope | "historical"
    recommendedQuantity: number | null
    notes: string | null
    totalUsed: number
    usageCount: number
    workOrderIds: Set<string>
    lastUsedAt: string | null
    lastWorkOrderId: string | null
  }>()

  for (const row of (links || []) as unknown as Array<{ id: string; relationship_type: SparePartRelationship; recommended_quantity: number | null; notes: string | null; part: PartRef | PartRef[] | null }>) {
    const part = relation(row.part)
    if (!part) continue
    grouped.set(part.id, {
      part,
      relationshipId: row.id,
      relationshipSource: "equipment",
      relationshipType: row.relationship_type,
      scopeType: "equipment",
      recommendedQuantity: row.recommended_quantity,
      notes: row.notes,
      totalUsed: 0,
      usageCount: 0,
      workOrderIds: new Set(),
      lastUsedAt: null,
      lastWorkOrderId: null,
    })
  }

  const scopePriority: Record<Exclude<CompatibilityScope, "equipment">, number> = { model: 4, manufacturer: 3, category: 2, universal: 1 }
  for (const rule of ((rules || []) as unknown as CompatibilityRuleRow[]).filter((candidate) => compatibilityRuleMatchesEquipment(candidate, equipment))) {
    const part = relation(rule.part)
    if (!part) continue
    const current = grouped.get(part.id)
    if (current?.relationshipSource === "equipment") continue
    if (current?.relationshipSource === "rule" && scopePriority[current.scopeType as Exclude<CompatibilityScope, "equipment">] >= scopePriority[rule.scope_type]) continue
    grouped.set(part.id, {
      part,
      relationshipId: rule.id,
      relationshipSource: "rule",
      relationshipType: rule.relationship_type,
      scopeType: rule.scope_type,
      recommendedQuantity: rule.recommended_quantity,
      notes: rule.notes,
      totalUsed: current?.totalUsed || 0,
      usageCount: current?.usageCount || 0,
      workOrderIds: current?.workOrderIds || new Set(),
      lastUsedAt: current?.lastUsedAt || null,
      lastWorkOrderId: current?.lastWorkOrderId || null,
    })
  }

  for (const usage of usageRecords) {
    const current = grouped.get(usage.part.id) || {
      part: usage.part,
      relationshipId: null,
      relationshipSource: "historical" as const,
      relationshipType: "historical" as const,
      scopeType: "historical" as const,
      recommendedQuantity: null,
      notes: null,
      totalUsed: 0,
      usageCount: 0,
      workOrderIds: new Set<string>(),
      lastUsedAt: null,
      lastWorkOrderId: null,
    }
    current.totalUsed += usage.quantity
    current.usageCount += 1
    current.workOrderIds.add(usage.workOrderId)
    if (!current.lastUsedAt || new Date(usage.usedAt).getTime() > new Date(current.lastUsedAt).getTime()) {
      current.lastUsedAt = usage.usedAt
      current.lastWorkOrderId = usage.workOrderId
    }
    grouped.set(usage.part.id, current)
  }

  const availableParts = ((inventoryParts || []) as Array<{ id: string; name: string; part_number: string | null; quantity_on_hand: number }>)
    .filter((part) => !grouped.has(part.id))
    .map((part) => ({ id: part.id, name: part.name, partNumber: part.part_number, quantityOnHand: Number(part.quantity_on_hand || 0) }))

  const parts = Array.from(grouped.values()).map((item): EquipmentRelatedPart => {
    const lastWorkOrder = item.lastWorkOrderId ? workOrdersById.get(item.lastWorkOrderId) : null
    return {
      relationshipId: item.relationshipId,
      relationshipSource: item.relationshipSource,
      relationshipType: item.relationshipType,
      scopeType: item.scopeType,
      scopeLabel: compatibilityScopeLabel(item.scopeType, equipment),
      recommendedQuantity: item.recommendedQuantity,
      notes: item.notes,
      partId: item.part.id,
      name: item.part.name,
      partNumber: item.part.part_number,
      quantityOnHand: Number(item.part.quantity_on_hand || 0),
      minThreshold: Number(item.part.min_threshold || 0),
      stockLocations: (item.part.balances || []).map((balance) => ({
        name: relation(balance.stock_location)?.name || "Stock location",
        code: relation(balance.stock_location)?.code || "—",
        binCode: balance.bin_code,
        quantity: Number(balance.quantity_on_hand || 0),
      })),
      supplier: item.part.supplier,
      totalUsed: item.totalUsed,
      usageCount: item.usageCount,
      workOrderCount: item.workOrderIds.size,
      lastUsedAt: item.lastUsedAt,
      lastWorkOrderId: item.lastWorkOrderId,
      lastWorkOrderDescription: lastWorkOrder?.description || null,
    }
  }).sort((a, b) => {
    if (a.relationshipType !== "historical" && b.relationshipType === "historical") return -1
    if (a.relationshipType === "historical" && b.relationshipType !== "historical") return 1
    return a.name.localeCompare(b.name)
  })

  return { parts, availableParts }
}

export async function addEquipmentSparePart(equipmentId: string, formData: FormData) {
  await requirePermission({ action: "write", resource: "equipment" }, `/equipment/${equipmentId}`)
  const user = await getCurrentUser()
  if (!user) return redirect("/login")

  const partId = String(formData.get("part_id") || "")
  const scopeType = String(formData.get("scope_type") || "model") as CompatibilityScope
  const relationshipType = String(formData.get("relationship_type") || "compatible") as SparePartRelationship
  const quantityRaw = String(formData.get("recommended_quantity") || "").trim()
  const notes = String(formData.get("notes") || "").trim()
  if (!partId || !["equipment", "model", "manufacturer", "category", "universal"].includes(scopeType) || !["compatible", "recommended", "critical"].includes(relationshipType)) {
    return redirect(equipmentPartsUrl(equipmentId, "Select a valid spare part and relationship"))
  }

  const recommendedQuantity = quantityRaw ? Number(quantityRaw) : null
  if (recommendedQuantity !== null && (!Number.isInteger(recommendedQuantity) || recommendedQuantity < 1)) {
    return redirect(equipmentPartsUrl(equipmentId, "Recommended quantity must be a positive whole number"))
  }

  const supabase = await createClient()
  const { data: equipment } = await supabase.from("equipment").select("manufacturer, model, device_category, category").eq("id", equipmentId).single()
  if (!equipment) return redirect(equipmentPartsUrl(equipmentId, "Equipment not found"))

  if (scopeType === "model" && (!equipment.manufacturer || !equipment.model)) {
    return redirect(equipmentPartsUrl(equipmentId, "Manufacturer and model are required for model-wide compatibility"))
  }
  if (scopeType === "manufacturer" && !equipment.manufacturer) {
    return redirect(equipmentPartsUrl(equipmentId, "Manufacturer is required for manufacturer-wide compatibility"))
  }
  if (scopeType === "category" && !(equipment.device_category || equipment.category)) {
    return redirect(equipmentPartsUrl(equipmentId, "Device category is required for category-wide compatibility"))
  }

  const write = scopeType === "equipment"
    ? supabase.from("equipment_spare_parts").insert({
      equipment_id: equipmentId,
      part_id: partId,
      relationship_type: relationshipType,
      recommended_quantity: recommendedQuantity,
      notes: notes || null,
      created_by: user.id,
    }).select("id").single()
    : supabase.from("spare_part_compatibility_rules").insert({
      part_id: partId,
      scope_type: scopeType,
      manufacturer: scopeType === "model" || scopeType === "manufacturer" ? equipment.manufacturer : null,
      model: scopeType === "model" ? equipment.model : null,
      device_category: scopeType === "category" ? equipment.device_category || equipment.category : null,
      relationship_type: relationshipType,
      recommended_quantity: recommendedQuantity,
      notes: notes || null,
      created_by: user.id,
    }).select("id").single()

  const { data, error } = await write

  if (error) return redirect(equipmentPartsUrl(equipmentId, error.message))
  const tableName = scopeType === "equipment" ? "equipment_spare_parts" : "spare_part_compatibility_rules"
  await logAudit(tableName, data.id, "insert", [{ newValue: JSON.stringify({ equipment_id: equipmentId, part_id: partId, scope_type: scopeType, relationship_type: relationshipType, recommended_quantity: recommendedQuantity }) }], `Spare part compatibility added for ${scopeType}`)
  revalidatePath(`/equipment/${equipmentId}`)
  redirect(equipmentPartsUrl(equipmentId))
}

export async function removeEquipmentPartRelationship(
  equipmentId: string,
  relationshipId: string,
  relationshipSource: "equipment" | "rule"
) {
  await requirePermission({ action: "write", resource: "equipment" }, `/equipment/${equipmentId}`)
  const supabase = await createClient()
  const tableName = relationshipSource === "equipment" ? "equipment_spare_parts" : "spare_part_compatibility_rules"
  const deleteQuery = supabase.from(tableName).delete().eq("id", relationshipId)
  const scopedDelete = relationshipSource === "equipment" ? deleteQuery.eq("equipment_id", equipmentId) : deleteQuery
  const { data, error } = await scopedDelete.select("part_id").single()
  if (error) return redirect(equipmentPartsUrl(equipmentId, error.message))
  await logAudit(tableName, relationshipId, "delete", [{ oldValue: JSON.stringify({ equipment_id: equipmentId, part_id: data.part_id }) }], relationshipSource === "rule" ? "Spare part compatibility rule removed" : "Spare part unlinked from equipment")
  revalidatePath(`/equipment/${equipmentId}`)
  redirect(equipmentPartsUrl(equipmentId))
}
