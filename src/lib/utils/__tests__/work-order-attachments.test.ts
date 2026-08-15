import { describe, expect, it } from "vitest"
import {
  MAX_IMAGE_ATTACHMENT_BYTES,
  MAX_VIDEO_ATTACHMENT_BYTES,
  validateWorkOrderAttachmentFile,
} from "@/lib/utils/work-order-attachments"

describe("work order attachment validation", () => {
  it("accepts supported image and video evidence within size limits", () => {
    expect(validateWorkOrderAttachmentFile({ type: "image/jpeg", size: 1024 })).toMatchObject({
      ok: true,
      mediaType: "image",
    })
    expect(validateWorkOrderAttachmentFile({ type: "video/mp4", size: 2048 })).toMatchObject({
      ok: true,
      mediaType: "video",
    })
  })

  it("rejects unsupported MIME types", () => {
    expect(validateWorkOrderAttachmentFile({ type: "application/pdf", size: 1024 })).toMatchObject({
      ok: false,
    })
  })

  it("enforces media-specific size limits", () => {
    expect(validateWorkOrderAttachmentFile({ type: "image/png", size: MAX_IMAGE_ATTACHMENT_BYTES + 1 })).toMatchObject({
      ok: false,
    })
    expect(validateWorkOrderAttachmentFile({ type: "video/webm", size: MAX_VIDEO_ATTACHMENT_BYTES + 1 })).toMatchObject({
      ok: false,
    })
  })
})
