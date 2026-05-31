"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { logAudit } from "@/lib/actions/audit"
import { faultReportSchema } from "@/lib/schemas/fault-report"

export async function submitFaultReport(formData: FormData) {
  const supabase = await createClient()
  const raw = Object.fromEntries(formData)

  const parsed = faultReportSchema.safeParse(raw)
  if (!parsed.success) {
    const messages = parsed.error.errors.map((e) => e.message).join(", ")
    return redirect(`/report?tag=${raw.equipment_tag || ""}&error=${encodeURIComponent(messages)}`)
  }

  const photo = formData.get("photo") as File | null
  if (!photo || photo.size === 0) {
    return redirect(`/report?tag=${raw.equipment_tag || ""}&error=${encodeURIComponent("Photo is required")}`)
  }

  // Create complaint
  const { data: complaint, error: complaintError } = await supabase
    .schema("ebiomed")
    .from("complaints")
    .insert({
      equipment_id: parsed.data.equipment_id,
      description: parsed.data.description,
      reported_by_name: parsed.data.reported_by_name || null,
      reported_by_department: parsed.data.reported_by_department || null,
      status: "pending_review",
    })
    .select("id, equipment_id")
    .single()

  if (complaintError || !complaint) {
    return redirect(`/report?tag=${raw.equipment_tag || ""}&error=${encodeURIComponent(complaintError?.message || "Failed to submit complaint")}`)
  }

  // Upload photo to storage (keyed by complaint ID)
  const ext = photo.name.split(".").pop() || "jpg"
  const photoPath = `${complaint.id}.${ext}`
  const { error: uploadError } = await supabase.storage
    .from("fault-photos")
    .upload(photoPath, photo, { contentType: photo.type, upsert: true })

  if (uploadError) {
    return redirect(`/report?tag=${raw.equipment_tag || ""}&error=${encodeURIComponent(uploadError.message)}`)
  }

  const { data: urlData } = supabase.storage.from("fault-photos").getPublicUrl(photoPath)

  // Update complaint with photo URL
  await supabase
    .schema("ebiomed")
    .from("complaints")
    .update({ photo_url: urlData.publicUrl })
    .eq("id", complaint.id)

  const reason = "Fault reported by " + (parsed.data.reported_by_name || "staff")
  await logAudit("complaints", complaint.id, "insert", [
    { newValue: JSON.stringify({ equipment_id: parsed.data.equipment_id, description: parsed.data.description, reported_by_name: parsed.data.reported_by_name, reported_by_department: parsed.data.reported_by_department, photo_url: urlData.publicUrl }) }
  ], reason)

  revalidatePath("/dashboard")
  revalidatePath("/complaints")
  redirect(`/report/success?complaint=${complaint.id}`)
}
