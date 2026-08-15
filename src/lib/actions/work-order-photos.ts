"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { logAudit } from "@/lib/actions/audit"
import { getCurrentUser } from "@/lib/actions/profiles"
import { createClient } from "@/lib/supabase/server"
import type { WorkOrderAttachment, WorkOrderPhoto } from "@/lib/types"
import { validateWorkOrderAttachmentFile } from "@/lib/utils/work-order-attachments"

const MEDIA_BUCKET = "work-order-media"

interface AttachmentActionResult {
  ok: boolean
  error?: string
  id?: string
}

function getAttachmentFile(formData: FormData) {
  const attachment = formData.get("attachment")
  if (attachment instanceof File) return attachment

  const photo = formData.get("photo")
  if (photo instanceof File) return photo

  return null
}

function extensionFor(file: File, mimeType: string) {
  const existing = file.name.split(".").pop()?.toLowerCase()
  if (existing && /^[a-z0-9]+$/.test(existing)) return existing

  if (mimeType === "image/jpeg") return "jpg"
  if (mimeType === "image/png") return "png"
  if (mimeType === "image/webp") return "webp"
  if (mimeType === "image/gif") return "gif"
  if (mimeType === "video/mp4") return "mp4"
  if (mimeType === "video/webm") return "webm"
  if (mimeType === "video/quicktime") return "mov"
  return "bin"
}

async function createWorkOrderAttachment(workOrderId: string, formData: FormData): Promise<AttachmentActionResult> {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: "Authentication required." }

  if (user.role === "viewer") {
    return { ok: false, error: "Viewers cannot upload work order evidence." }
  }

  const file = getAttachmentFile(formData)
  const caption = String(formData.get("caption") || "").trim()

  if (!file || file.size === 0) {
    return { ok: false, error: "Photo or video evidence is required." }
  }

  const validation = validateWorkOrderAttachmentFile(file)
  if (!validation.ok) return { ok: false, error: validation.error }

  const { data: workOrder } = await supabase
    .schema("ebiomed")
    .from("work_orders")
    .select("id, status")
    .eq("id", workOrderId)
    .single()

  if (!workOrder) {
    return { ok: false, error: "Work order not found." }
  }

  if (workOrder.status === "completed" || workOrder.status === "cancelled") {
    return { ok: false, error: "Cannot upload evidence to a closed work order." }
  }

  const extension = extensionFor(file, validation.mimeType)
  const path = `work-orders/${workOrderId}/${crypto.randomUUID()}.${extension}`
  const { error: uploadError } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, file, {
      contentType: validation.mimeType,
      upsert: false,
    })

  if (uploadError) return { ok: false, error: uploadError.message }

  const { data: urlData } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path)

  const { data, error } = await supabase
    .schema("ebiomed")
    .from("work_order_attachments")
    .insert({
      work_order_id: workOrderId,
      file_url: urlData.publicUrl,
      file_name: file.name || null,
      mime_type: validation.mimeType,
      media_type: validation.mediaType,
      file_size_bytes: file.size,
      caption: caption || null,
      uploaded_by: user.id,
    })
    .select("id")
    .single()

  if (error) return { ok: false, error: error.message }

  await logAudit("work_order_attachments", data.id, "insert", [
    {
      newValue: JSON.stringify({
        work_order_id: workOrderId,
        caption: caption || null,
        file_url: urlData.publicUrl,
        media_type: validation.mediaType,
      }),
    },
  ], caption || "Work order evidence uploaded")

  return { ok: true, id: data.id }
}

export async function uploadWorkOrderPhoto(workOrderId: string, formData: FormData) {
  const user = await getCurrentUser()
  if (!user) return redirect("/login")

  const result = await createWorkOrderAttachment(workOrderId, formData)
  if (!result.ok) {
    return redirect(`/work-orders/${workOrderId}?error=${encodeURIComponent(result.error || "Evidence upload failed.")}`)
  }

  revalidatePath(`/work-orders/${workOrderId}`)
  redirect(`/work-orders/${workOrderId}`)
}

export async function uploadWorkOrderAttachment(workOrderId: string, formData: FormData) {
  return uploadWorkOrderPhoto(workOrderId, formData)
}

export async function syncOfflineWorkOrderAttachmentDraft(workOrderId: string, formData: FormData): Promise<AttachmentActionResult> {
  const result = await createWorkOrderAttachment(workOrderId, formData)
  if (result.ok) revalidatePath(`/work-orders/${workOrderId}`)
  return result
}

export async function getWorkOrderAttachments(workOrderId: string): Promise<WorkOrderAttachment[]> {
  const supabase = await createClient()
  const [attachments, legacyPhotos] = await Promise.all([
    supabase
      .schema("ebiomed")
      .from("work_order_attachments")
      .select("*, uploader:uploaded_by(full_name, role)")
      .eq("work_order_id", workOrderId)
      .order("created_at", { ascending: false }),
    supabase
      .schema("ebiomed")
      .from("work_order_photos")
      .select("*, uploader:uploaded_by(full_name, role)")
      .eq("work_order_id", workOrderId)
      .order("created_at", { ascending: false }),
  ])

  const normalizedAttachments = ((attachments.data || []) as unknown as WorkOrderAttachment[])
  const normalizedLegacy = ((legacyPhotos.data || []) as WorkOrderPhoto[]).map((photo) => ({
    id: `legacy-photo-${photo.id}`,
    work_order_id: photo.work_order_id,
    file_url: photo.photo_url,
    file_name: null,
    mime_type: "image/jpeg",
    media_type: "image" as const,
    file_size_bytes: null,
    caption: photo.caption,
    uploaded_by: photo.uploaded_by,
    created_at: photo.created_at,
    uploader: photo.uploader,
    photo_url: photo.photo_url,
  }))

  return [...normalizedAttachments, ...normalizedLegacy].sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export async function getWorkOrderPhotos(workOrderId: string): Promise<WorkOrderPhoto[]> {
  const attachments = await getWorkOrderAttachments(workOrderId)
  return attachments
    .filter((attachment) => attachment.media_type === "image")
    .map((attachment) => ({
      id: attachment.id,
      work_order_id: attachment.work_order_id,
      photo_url: attachment.file_url,
      caption: attachment.caption,
      uploaded_by: attachment.uploaded_by,
      created_at: attachment.created_at,
      uploader: attachment.uploader,
    }))
}
