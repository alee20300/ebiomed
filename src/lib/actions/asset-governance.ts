"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { logAudit } from "@/lib/actions/audit"
import { getCurrentUser } from "@/lib/actions/profiles"
import { requirePermission } from "@/lib/actions/permissions"
import { recordSignature, verifyPassword } from "@/lib/actions/signatures"
import {
  commissioningRecordSchema,
  cybersecurityAssessmentSchema,
  decommissioningRecordSchema,
} from "@/lib/schemas/asset-governance"
import type { CommissioningRecord, CybersecurityAssessment, DecommissioningRecord } from "@/lib/types"

function parseVulnerabilities(value: string | undefined) {
  if (!value?.trim()) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : [{ note: value }]
  } catch {
    return value.split("\n").map((line) => line.trim()).filter(Boolean).map((note) => ({ note }))
  }
}

export async function getAssetGovernanceData(equipmentId: string) {
  const supabase = await createClient()
  const [cybersecurity, commissioning, decommissioning] = await Promise.all([
    supabase
      .schema("ebiomed")
      .from("cybersecurity_assessments")
      .select("*, assessor:assessed_by(full_name, role)")
      .eq("equipment_id", equipmentId)
      .order("assessed_at", { ascending: false }),
    supabase
      .schema("ebiomed")
      .from("commissioning_records")
      .select("*, creator:created_by(full_name, role), approver:approved_by(full_name, role)")
      .eq("equipment_id", equipmentId)
      .order("created_at", { ascending: false }),
    supabase
      .schema("ebiomed")
      .from("decommissioning_records")
      .select("*, completer:completed_by(full_name, role)")
      .eq("equipment_id", equipmentId)
      .order("completed_at", { ascending: false }),
  ])

  return {
    cybersecurity: (cybersecurity.data || []) as unknown as CybersecurityAssessment[],
    commissioning: (commissioning.data || []) as unknown as CommissioningRecord[],
    decommissioning: (decommissioning.data || []) as unknown as DecommissioningRecord[],
  }
}

export async function recordCybersecurityAssessment(equipmentId: string, formData: FormData) {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) return redirect("/login")
  await requirePermission({ action: "lifecycle", resource: "equipment" }, `/equipment/${equipmentId}`)

  const parsed = cybersecurityAssessmentSchema.safeParse({
    ...Object.fromEntries(formData),
    equipment_id: equipmentId,
  })
  if (!parsed.success) {
    return redirect(`/equipment/${equipmentId}?error=${encodeURIComponent(parsed.error.issues.map((issue) => issue.message).join(", "))}`)
  }

  if (parsed.data.assessment_status === "risk_acceptance_required") {
    const verified = !!parsed.data.reauth_password && await verifyPassword(parsed.data.reauth_password)
    if (!verified) {
      return redirect(`/equipment/${equipmentId}?error=${encodeURIComponent("Re-authentication is required for cybersecurity risk acceptance")}`)
    }
  }

  const riskAcceptanceStatus = parsed.data.assessment_status === "risk_acceptance_required" ? "accepted" : "not_required"
  const { data, error } = await supabase
    .schema("ebiomed")
    .from("cybersecurity_assessments")
    .insert({
      equipment_id: equipmentId,
      assessment_status: parsed.data.assessment_status,
      patch_status: parsed.data.patch_status,
      antivirus_status: parsed.data.antivirus_status,
      backup_status: parsed.data.backup_status,
      internet_exposed: parsed.data.internet_exposed,
      remote_access_enabled: parsed.data.remote_access_enabled,
      vulnerabilities: parseVulnerabilities(parsed.data.vulnerabilities),
      assessment_notes: parsed.data.assessment_notes,
      risk_acceptance_reason: parsed.data.risk_acceptance_reason || null,
      risk_acceptance_expires_at: parsed.data.risk_acceptance_expires_at || null,
      assessed_by: user.id,
    })
    .select("id")
    .single()

  if (error) {
    return redirect(`/equipment/${equipmentId}?error=${encodeURIComponent(error.message)}`)
  }

  await supabase
    .schema("ebiomed")
    .from("equipment")
    .update({
      patch_status: parsed.data.patch_status,
      antivirus_status: parsed.data.antivirus_status,
      backup_status: parsed.data.backup_status,
      internet_exposed: parsed.data.internet_exposed,
      remote_access_enabled: parsed.data.remote_access_enabled,
      risk_acceptance_status: riskAcceptanceStatus,
      risk_acceptance_expires_at: parsed.data.risk_acceptance_expires_at || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", equipmentId)

  await logAudit("cybersecurity_assessments", data.id, "insert", [
    { newValue: JSON.stringify({ equipment_id: equipmentId, assessment_status: parsed.data.assessment_status, patch_status: parsed.data.patch_status }) },
  ], parsed.data.assessment_notes)

  if (riskAcceptanceStatus === "accepted") {
    await recordSignature("equipment", equipmentId, "Reviewed", parsed.data.risk_acceptance_reason || parsed.data.assessment_notes)
  }

  revalidatePath(`/equipment/${equipmentId}`)
  redirect(`/equipment/${equipmentId}`)
}

export async function recordCommissioning(equipmentId: string, formData: FormData) {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) return redirect("/login")
  await requirePermission({ action: "lifecycle", resource: "equipment" }, `/equipment/${equipmentId}`)

  const parsed = commissioningRecordSchema.safeParse({
    ...Object.fromEntries(formData),
    equipment_id: equipmentId,
  })
  if (!parsed.success) {
    return redirect(`/equipment/${equipmentId}?error=${encodeURIComponent(parsed.error.issues.map((issue) => issue.message).join(", "))}`)
  }

  if (parsed.data.commissioning_status === "approved_for_service") {
    const verified = !!parsed.data.reauth_password && await verifyPassword(parsed.data.reauth_password)
    if (!verified) {
      return redirect(`/equipment/${equipmentId}?error=${encodeURIComponent("Re-authentication is required to approve commissioning")}`)
    }
  }

  const approved = parsed.data.commissioning_status === "approved_for_service"
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .schema("ebiomed")
    .from("commissioning_records")
    .insert({
      equipment_id: equipmentId,
      commissioning_status: parsed.data.commissioning_status,
      installation_verified: parsed.data.installation_verified,
      acceptance_test_passed: parsed.data.acceptance_test_passed,
      user_training_completed: parsed.data.user_training_completed,
      handover_completed: parsed.data.handover_completed,
      evidence_notes: parsed.data.evidence_notes,
      approved_by: approved ? user.id : null,
      approved_at: approved ? now : null,
      created_by: user.id,
    })
    .select("id")
    .single()

  if (error) return redirect(`/equipment/${equipmentId}?error=${encodeURIComponent(error.message)}`)

  await supabase
    .schema("ebiomed")
    .from("equipment")
    .update({
      commissioning_status: parsed.data.commissioning_status,
      commissioning_approved_by: approved ? user.id : null,
      commissioning_approved_at: approved ? now : null,
      commissioned_at: approved ? now : undefined,
      lifecycle_stage: approved ? "in_service" : "commissioning",
      status: approved ? "active" : undefined,
      updated_at: now,
    })
    .eq("id", equipmentId)

  await logAudit("commissioning_records", data.id, "insert", [
    { newValue: JSON.stringify({ equipment_id: equipmentId, commissioning_status: parsed.data.commissioning_status }) },
  ], parsed.data.evidence_notes)

  if (approved) {
    await recordSignature("equipment", equipmentId, "Approved", parsed.data.evidence_notes)
  }

  revalidatePath(`/equipment/${equipmentId}`)
  redirect(`/equipment/${equipmentId}`)
}

export async function recordDecommissioning(equipmentId: string, formData: FormData) {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) return redirect("/login")
  await requirePermission({ action: "retire", resource: "equipment" }, `/equipment/${equipmentId}`)

  const parsed = decommissioningRecordSchema.safeParse({
    ...Object.fromEntries(formData),
    equipment_id: equipmentId,
  })
  if (!parsed.success) {
    return redirect(`/equipment/${equipmentId}?error=${encodeURIComponent(parsed.error.issues.map((issue) => issue.message).join(", "))}`)
  }

  const { data: equipment } = await supabase
    .schema("ebiomed")
    .from("equipment")
    .select("network_connected")
    .eq("id", equipmentId)
    .single()

  if (equipment?.network_connected && parsed.data.data_sanitization_status !== "completed") {
    return redirect(`/equipment/${equipmentId}?error=${encodeURIComponent("Network-connected assets require completed data sanitization")}`)
  }

  const verified = await verifyPassword(parsed.data.reauth_password)
  if (!verified) {
    return redirect(`/equipment/${equipmentId}?error=${encodeURIComponent("Re-authentication is required to decommission an asset")}`)
  }

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .schema("ebiomed")
    .from("decommissioning_records")
    .insert({
      equipment_id: equipmentId,
      disposal_method: parsed.data.disposal_method,
      data_sanitization_status: parsed.data.data_sanitization_status,
      accessories_recovered: parsed.data.accessories_recovered,
      hazardous_material_checked: parsed.data.hazardous_material_checked,
      finance_approval_reference: parsed.data.finance_approval_reference || null,
      final_location: parsed.data.final_location || null,
      certificate_url: parsed.data.certificate_url || null,
      evidence_notes: parsed.data.evidence_notes,
      completed_by: user.id,
      completed_at: now,
    })
    .select("id")
    .single()

  if (error) return redirect(`/equipment/${equipmentId}?error=${encodeURIComponent(error.message)}`)

  await supabase
    .schema("ebiomed")
    .from("equipment")
    .update({
      status: "retired",
      lifecycle_stage: "retired",
      retirement_reason: parsed.data.evidence_notes,
      decommissioning_status: "completed",
      decommissioned_by: user.id,
      decommissioned_at: now,
      updated_at: now,
    })
    .eq("id", equipmentId)

  await logAudit("decommissioning_records", data.id, "insert", [
    { newValue: JSON.stringify({ equipment_id: equipmentId, disposal_method: parsed.data.disposal_method }) },
  ], parsed.data.evidence_notes)
  await recordSignature("equipment", equipmentId, "Approved", parsed.data.evidence_notes)

  revalidatePath(`/equipment/${equipmentId}`)
  revalidatePath("/equipment")
  redirect(`/equipment/${equipmentId}`)
}
