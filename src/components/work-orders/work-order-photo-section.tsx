import { Camera, ImageIcon, Video } from "lucide-react"
import { getWorkOrderAttachments } from "@/lib/actions/work-order-photos"
import { WorkOrderMediaDraftForm } from "@/components/work-orders/work-order-media-draft-form"
import { formatRelative } from "@/lib/utils/format"

interface Props {
  workOrderId: string
  woStatus: string
}

export async function WorkOrderPhotoSection({ workOrderId, woStatus }: Props) {
  const attachments = await getWorkOrderAttachments(workOrderId)
  const canUpload = woStatus !== "completed" && woStatus !== "cancelled"

  return (
    <div className="rounded-lg border bg-white p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <Camera className="h-5 w-5" />
          Field Evidence
        </h3>
        <span className="text-sm text-muted-foreground">{attachments.length}</span>
      </div>

      {canUpload && (
        <WorkOrderMediaDraftForm workOrderId={workOrderId} />
      )}

      {attachments.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          <ImageIcon className="mb-2 h-8 w-8" />
          No field evidence yet.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {attachments.map((attachment) => (
            <figure key={attachment.id} className="overflow-hidden rounded-lg border bg-card">
              {attachment.media_type === "video" ? (
                <video
                  src={attachment.file_url}
                  controls
                  className="aspect-[4/3] w-full bg-black object-contain"
                />
              ) : (
                <a href={attachment.file_url} target="_blank" rel="noreferrer">
                  <img
                    src={attachment.file_url}
                    alt={attachment.caption || "Work order field evidence"}
                    className="aspect-[4/3] w-full object-cover"
                  />
                </a>
              )}
              <figcaption className="space-y-1 p-3 text-sm">
                <div className="flex items-center gap-2">
                  {attachment.media_type === "video" && <Video className="h-4 w-4 text-muted-foreground" />}
                  {attachment.caption && <p className="font-medium">{attachment.caption}</p>}
                </div>
                {attachment.file_name && (
                  <p className="truncate text-xs text-muted-foreground">{attachment.file_name}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {attachment.uploader?.full_name || "Unknown"} · {formatRelative(attachment.created_at)}
                </p>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  )
}
