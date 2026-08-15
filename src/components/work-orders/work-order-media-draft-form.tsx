"use client"

import { useState } from "react"
import { uploadWorkOrderAttachment } from "@/lib/actions/work-order-photos"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  enqueueOfflineDraft,
  type MediaAttachmentDraftPayload,
} from "@/lib/offline/work-order-drafts"

interface Props {
  workOrderId: string
}

function getMediaType(file: File): "image" | "video" {
  return file.type.startsWith("video/") ? "video" : "image"
}

export function WorkOrderMediaDraftForm({ workOrderId }: Props) {
  const [message, setMessage] = useState("")

  return (
    <form
      action={async (formData) => {
        setMessage("")
        const file = formData.get("attachment")
        if (!(file instanceof File) || file.size === 0) {
          setMessage("Select a photo or video first.")
          return
        }

        const mediaType = getMediaType(file)
        if (!navigator.onLine) {
          const payload: MediaAttachmentDraftPayload = {
            workOrderId,
            caption: String(formData.get("caption") || "").trim() || null,
            mediaType,
            fileName: file.name,
            mimeType: file.type || "application/octet-stream",
            size: file.size,
            blob: file,
          }
          await enqueueOfflineDraft("media_attachment", workOrderId, payload)
          setMessage("Offline evidence saved as a draft.")
          return
        }

        await uploadWorkOrderAttachment(workOrderId, formData)
      }}
      className="mb-5 space-y-3 rounded-lg border bg-muted/20 p-3"
    >
      <Input
        name="attachment"
        type="file"
        accept="image/*,video/*"
        capture="environment"
        required
        className="h-auto py-2"
      />
      <Input
        name="caption"
        maxLength={180}
        placeholder="Caption or repair step"
      />
      <Button type="submit" className="w-full sm:w-auto">
        Upload Evidence
      </Button>
      {message && <p className="text-xs text-muted-foreground">{message}</p>}
    </form>
  )
}
