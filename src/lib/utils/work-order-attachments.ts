export type WorkOrderAttachmentMediaType = "image" | "video"

export const MAX_IMAGE_ATTACHMENT_BYTES = 10 * 1024 * 1024
export const MAX_VIDEO_ATTACHMENT_BYTES = 100 * 1024 * 1024

export const ALLOWED_WORK_ORDER_ATTACHMENT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
] as const

export function getWorkOrderAttachmentMediaType(mimeType: string): WorkOrderAttachmentMediaType | null {
  if (mimeType.startsWith("image/")) return "image"
  if (mimeType.startsWith("video/")) return "video"
  return null
}

export function getMaxWorkOrderAttachmentBytes(mediaType: WorkOrderAttachmentMediaType) {
  return mediaType === "image" ? MAX_IMAGE_ATTACHMENT_BYTES : MAX_VIDEO_ATTACHMENT_BYTES
}

export function validateWorkOrderAttachmentFile(file: Pick<File, "size" | "type">) {
  const mimeType = file.type || "application/octet-stream"
  const mediaType = getWorkOrderAttachmentMediaType(mimeType)

  if (!mediaType || !(ALLOWED_WORK_ORDER_ATTACHMENT_MIME_TYPES as readonly string[]).includes(mimeType)) {
    return {
      ok: false as const,
      error: "Unsupported attachment type. Upload JPG, PNG, WebP, GIF, MP4, WebM, or MOV evidence.",
    }
  }

  const maxBytes = getMaxWorkOrderAttachmentBytes(mediaType)
  if (file.size <= 0) {
    return { ok: false as const, error: "Attachment is required." }
  }
  if (file.size > maxBytes) {
    const maxMb = Math.floor(maxBytes / 1024 / 1024)
    return { ok: false as const, error: `${mediaType === "image" ? "Image" : "Video"} attachments must be ${maxMb} MB or smaller.` }
  }

  return { ok: true as const, mediaType, mimeType }
}
