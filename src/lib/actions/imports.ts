"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/lib/actions/profiles"
import { logAudit } from "@/lib/actions/audit"
import { requirePermission } from "@/lib/actions/permissions"
import type { ImportTemplate } from "@/lib/imports/templates"
import { validateImportRows } from "@/lib/imports/validation"
import { computeImportSourceHash, validateImportCommitIntegrity } from "@/lib/imports/integrity"

export async function previewImport(formData: FormData) {
  const user = await getCurrentUser()
  if (!user) return redirect("/dashboard")
  await requirePermission({ action: "preview", resource: "imports" }, "/settings")
  const supabase = await createClient()
  const template = String(formData.get("template") || "equipment") as ImportTemplate
  const file = formData.get("file")
  if (!(file instanceof File)) return redirect(`/settings?error=${encodeURIComponent("CSV file is required")}`)
  const csvText = await file.text()
  const result = validateImportRows(template, csvText)

  const { data, error } = await supabase
    .schema("ebiomed")
    .from("import_batches")
    .insert({
      template,
      filename: file.name,
      status: "previewed",
      total_rows: result.totalRows,
      valid_rows: result.validRows,
      duplicate_rows: result.duplicateMatches.length,
      error_rows: result.errors.length,
      preview: result.preview.slice(0, 100),
      errors: result.errors,
      duplicate_matches: result.duplicateMatches,
      source_hash: computeImportSourceHash(csvText),
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return redirect(`/settings?error=${encodeURIComponent(error.message)}`)
  await logAudit("import_batches", data.id, "insert", [{ newValue: JSON.stringify({ template, rows: result.totalRows }) }], "Import preview created")
  revalidatePath("/settings")
  redirect(`/settings?import_batch=${data.id}`)
}

export async function rollbackImportBatch(formData: FormData) {
  const user = await getCurrentUser()
  if (!user) return redirect("/dashboard")
  await requirePermission({ action: "rollback", resource: "imports" }, "/settings")
  const supabase = await createClient()
  const id = String(formData.get("id") || "")
  const { data: batch, error: fetchError } = await supabase
    .schema("ebiomed")
    .from("import_batches")
    .select("status, rollback_payload")
    .eq("id", id)
    .single()
  if (fetchError || !batch) return redirect(`/settings?error=${encodeURIComponent(fetchError?.message || "Import batch not found")}`)

  const rollbackPayload = (batch.rollback_payload || []) as Array<{ table: string; id: string }>
  for (const row of rollbackPayload.reverse()) {
    if (!["equipment", "parts", "vendors", "pm_schedules"].includes(row.table)) continue
    const { error: deleteError } = await supabase.schema("ebiomed").from(row.table).delete().eq("id", row.id)
    if (deleteError) return redirect(`/settings?error=${encodeURIComponent(deleteError.message)}`)
  }

  const { error } = await supabase
    .schema("ebiomed")
    .from("import_batches")
    .update({ status: "rolled_back", rolled_back_by: user.id, rolled_back_at: new Date().toISOString() })
    .eq("id", id)
  if (error) return redirect(`/settings?error=${encodeURIComponent(error.message)}`)
  await logAudit("import_batches", id, "update", [{ field: "status", oldValue: "previewed", newValue: "rolled_back" }], "Import batch rolled back")
  revalidatePath("/settings")
  redirect("/settings")
}

export async function commitImportBatch(formData: FormData) {
  const user = await getCurrentUser()
  if (!user) return redirect("/dashboard")
  await requirePermission({ action: "commit", resource: "imports" }, "/settings")
  const supabase = await createClient()
  const id = String(formData.get("id") || "")
  const { data: batch, error: batchError } = await supabase
    .schema("ebiomed")
    .from("import_batches")
    .select("*")
    .eq("id", id)
    .single()

  if (batchError || !batch) return redirect(`/settings?error=${encodeURIComponent(batchError?.message || "Import batch not found")}`)
  const integrity = validateImportCommitIntegrity(batch)
  if (!integrity.ok) return redirect(`/settings?error=${encodeURIComponent(integrity.error)}`)

  const rows = (batch.preview || []) as Array<Record<string, string>>
  const rollbackPayload: Array<{ table: string; id: string }> = []

  if (batch.template === "equipment") {
    for (const row of rows) {
      const { data, error } = await supabase
        .schema("ebiomed")
        .from("equipment")
        .upsert({
          tag_number: row.tag_number,
          name: row.name,
          serial_number: row.serial_number || null,
          model: row.model || null,
          manufacturer: row.manufacturer || null,
          department: row.department || null,
          location: row.location || null,
          status: row.status || "active",
        }, { onConflict: "tag_number" })
        .select("id")
        .single()
      if (error) return redirect(`/settings?error=${encodeURIComponent(error.message)}`)
      rollbackPayload.push({ table: "equipment", id: data.id })
    }
  } else if (batch.template === "parts") {
    for (const row of rows) {
      const payload = {
          name: row.name,
          part_number: row.part_number || null,
          quantity_on_hand: Number(row.quantity_on_hand || 0),
          min_threshold: Number(row.min_threshold || 0),
          max_threshold: row.max_threshold ? Number(row.max_threshold) : null,
          reorder_quantity: row.reorder_quantity ? Number(row.reorder_quantity) : null,
          unit_cost: row.unit_cost ? Number(row.unit_cost) : null,
          supplier: row.supplier || null,
          stock_location: row.stock_location || null,
          bin_code: row.bin_code || null,
      }
      const query = supabase.schema("ebiomed").from("parts")
      const { data, error } = row.part_number
        ? await query.update(payload).eq("part_number", row.part_number).select("id").maybeSingle()
        : await query.insert(payload).select("id").single()
      if (error) return redirect(`/settings?error=${encodeURIComponent(error.message)}`)
      if (data) {
        rollbackPayload.push({ table: "parts", id: data.id })
      } else {
        const { data: inserted, error: insertError } = await supabase.schema("ebiomed").from("parts").insert(payload).select("id").single()
        if (insertError) return redirect(`/settings?error=${encodeURIComponent(insertError.message)}`)
        rollbackPayload.push({ table: "parts", id: inserted.id })
      }
    }
  } else if (batch.template === "vendors") {
    for (const row of rows) {
      const { data, error } = await supabase
        .schema("ebiomed")
        .from("vendors")
        .upsert({
          name: row.name,
          contact_name: row.contact_name || null,
          email: row.email || null,
          phone: row.phone || null,
          address: row.address || null,
          notes: row.notes || null,
        }, { onConflict: "name" })
        .select("id")
        .single()
      if (error) return redirect(`/settings?error=${encodeURIComponent(error.message)}`)
      rollbackPayload.push({ table: "vendors", id: data.id })
    }
  } else if (batch.template === "pms") {
    for (const row of rows) {
      const { data: equipment } = await supabase
        .schema("ebiomed")
        .from("equipment")
        .select("id")
        .eq("tag_number", row.equipment_tag)
        .single()
      if (!equipment) return redirect(`/settings?error=${encodeURIComponent(`No equipment found for ${row.equipment_tag}`)}`)
      const { data, error } = await supabase
        .schema("ebiomed")
        .from("pm_schedules")
        .insert({
          equipment_id: equipment.id,
          frequency_days: Number(row.frequency_days || 365),
          description: row.description || null,
          next_due: row.next_due || null,
          active: true,
        })
        .select("id")
        .single()
      if (error) return redirect(`/settings?error=${encodeURIComponent(error.message)}`)
      rollbackPayload.push({ table: "pm_schedules", id: data.id })
    }
  } else {
    return redirect(`/settings?error=${encodeURIComponent("User imports require SSO/Auth user provisioning before commit")}`)
  }

  const { error } = await supabase
    .schema("ebiomed")
    .from("import_batches")
    .update({
      status: "committed",
      rollback_payload: rollbackPayload,
      committed_rows: rollbackPayload.length,
      commit_summary: {
        template: batch.template,
        committed_rows: rollbackPayload.length,
        source_hash: batch.source_hash || null,
      },
      committed_by: user.id,
      committed_at: new Date().toISOString(),
    })
    .eq("id", id)
  if (error) return redirect(`/settings?error=${encodeURIComponent(error.message)}`)
  await logAudit("import_batches", id, "update", [{ field: "status", oldValue: "previewed", newValue: "committed" }], "Import batch committed")
  revalidatePath("/settings")
  redirect(`/settings?import_batch=${id}`)
}
