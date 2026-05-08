"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
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

  // Create work order first to get an ID for the photo path
  const { data: wo, error: woError } = await supabase
    .schema("ebiomed")
    .from("work_orders")
    .insert({
      equipment_id: parsed.data.equipment_id,
      type: "corrective",
      priority: "medium",
      status: "open",
      description: parsed.data.description,
      reported_by_name: parsed.data.reported_by_name || null,
      reported_by_department: parsed.data.reported_by_department || null,
    })
    .select("id, equipment_id")
    .single()

  if (woError || !wo) {
    return redirect(`/report?tag=${raw.equipment_tag || ""}&error=${encodeURIComponent(woError?.message || "Failed to create work order")}`)
  }

  // Upload photo to storage
  const ext = photo.name.split(".").pop() || "jpg"
  const photoPath = `${wo.id}.${ext}`
  const { error: uploadError } = await supabase.storage
    .from("fault-photos")
    .upload(photoPath, photo, { contentType: photo.type, upsert: true })

  if (uploadError) {
    return redirect(`/report?tag=${raw.equipment_tag || ""}&error=${encodeURIComponent(uploadError.message)}`)
  }

  const { data: urlData } = supabase.storage.from("fault-photos").getPublicUrl(photoPath)

  // Update WO with photo URL
  await supabase
    .schema("ebiomed")
    .from("work_orders")
    .update({ issue_photo_url: urlData.publicUrl })
    .eq("id", wo.id)

  // Set equipment to under_repair
  await supabase
    .schema("ebiomed")
    .from("equipment")
    .update({ status: "under_repair", updated_at: new Date().toISOString() })
    .eq("id", wo.equipment_id)

  revalidatePath("/dashboard")
  revalidatePath("/work-orders")
  revalidatePath(`/equipment/${wo.equipment_id}`)
  redirect(`/report/success?wo=${wo.id}`)
}
