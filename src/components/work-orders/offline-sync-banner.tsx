"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, CheckCircle2, RefreshCw, WifiOff } from "lucide-react"
import { addJobCardEntry } from "@/lib/actions/job-cards"
import { syncOfflinePartsUsageDraft } from "@/lib/actions/parts"
import { syncOfflineWorkOrderAttachmentDraft } from "@/lib/actions/work-order-photos"
import { syncOfflineWorkOrderStatusDraft } from "@/lib/actions/work-orders"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import {
  OFFLINE_DRAFTS_EVENT,
  deleteOfflineDraft,
  isTerminalWorkOrderStatus,
  jobCardEntryDraftToFormData,
  listOfflineDrafts,
  mediaAttachmentDraftToFormData,
  summarizeOfflineDrafts,
  updateOfflineDraft,
  type JobCardEntryDraftPayload,
  type MediaAttachmentDraftPayload,
  type OfflineDraft,
  type PartsUsageDraftPayload,
  type WorkOrderStatusDraftPayload,
} from "@/lib/offline/work-order-drafts"

interface Props {
  workOrderId: string
}

async function syncDraft(draft: OfflineDraft) {
  if (draft.type === "work_order_status") {
    const payload = draft.payload as WorkOrderStatusDraftPayload
    if (isTerminalWorkOrderStatus(payload.status)) {
      return { ok: false, error: "Open the work order and re-authenticate before syncing this closeout draft." }
    }
    return syncOfflineWorkOrderStatusDraft(payload)
  }

  if (draft.type === "job_card_entry") {
    const payload = draft.payload as JobCardEntryDraftPayload
    await addJobCardEntry(payload.jobCardId, jobCardEntryDraftToFormData(payload))
    return { ok: true }
  }

  if (draft.type === "parts_usage") {
    return syncOfflinePartsUsageDraft(draft.payload as PartsUsageDraftPayload)
  }

  if (draft.type === "media_attachment") {
    const payload = draft.payload as MediaAttachmentDraftPayload
    return syncOfflineWorkOrderAttachmentDraft(payload.workOrderId, mediaAttachmentDraftToFormData(payload))
  }

  return { ok: false, error: "Unsupported offline draft type." }
}

export function OfflineSyncBanner({ workOrderId }: Props) {
  const [drafts, setDrafts] = useState<OfflineDraft[]>([])
  const [online, setOnline] = useState(() => (
    typeof navigator === "undefined" ? true : navigator.onLine
  ))
  const [syncing, setSyncing] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  const summary = useMemo(() => summarizeOfflineDrafts(drafts), [drafts])
  const visible = summary.total > 0 || !online

  const refresh = useCallback(async () => {
    setDrafts(await listOfflineDrafts(workOrderId))
  }, [workOrderId])

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => {
      refresh()
    }, 0)

    const handleOnline = () => {
      setOnline(true)
      refresh()
    }
    const handleOffline = () => setOnline(false)
    const handleDrafts = () => refresh()

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    window.addEventListener(OFFLINE_DRAFTS_EVENT, handleDrafts)
    return () => {
      window.clearTimeout(initialRefresh)
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
      window.removeEventListener(OFFLINE_DRAFTS_EVENT, handleDrafts)
    }
  }, [refresh])

  const retry = async () => {
    if (!online || syncing) return
    setSyncing(true)
    const pendingDrafts = (await listOfflineDrafts(workOrderId)).filter((draft) => (
      draft.status === "pending" || draft.status === "failed"
    ))

    for (const draft of pendingDrafts) {
      const syncingDraft = await updateOfflineDraft(draft, {
        status: "syncing",
        attempts: draft.attempts + 1,
        error: null,
      })

      const live = await supabase
        .schema("ebiomed")
        .from("work_orders")
        .select("status")
        .eq("id", draft.workOrderId)
        .single()

      if (live.data?.status === "completed" || live.data?.status === "cancelled") {
        await updateOfflineDraft(syncingDraft, {
          status: "failed",
          error: "Work order was closed before this draft synced.",
        })
        continue
      }

      try {
        const result = await syncDraft(syncingDraft)
        if (result.ok) {
          await updateOfflineDraft(syncingDraft, {
            status: "synced",
            error: null,
            syncedAt: new Date().toISOString(),
          })
        } else {
          await updateOfflineDraft(syncingDraft, {
            status: "failed",
            error: result.error || "Draft sync failed.",
          })
        }
      } catch (error) {
        await updateOfflineDraft(syncingDraft, {
          status: "failed",
          error: error instanceof Error ? error.message : "Draft sync failed.",
        })
      }
    }

    setSyncing(false)
    refresh()
  }

  const clearSynced = async () => {
    const synced = drafts.filter((draft) => draft.status === "synced")
    for (const draft of synced) {
      await deleteOfflineDraft(draft.id)
    }
    refresh()
  }

  if (!visible) return null

  return (
    <div className="rounded-lg border bg-white p-3 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          {online ? (
            summary.failed > 0 ? (
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning-strong" />
            ) : (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success-strong" />
            )
          ) : (
            <WifiOff className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
          )}
          <div>
            <p className="text-sm font-medium">
              {online ? "Offline Draft Queue" : "Offline Mode"}
            </p>
            <p className="text-xs text-muted-foreground">
              {summary.pending} pending · {summary.syncing} syncing · {summary.failed} failed · {summary.synced} synced
            </p>
            {drafts.find((draft) => draft.status === "failed")?.error && (
              <p className="mt-1 text-xs text-warning-strong">
                {drafts.find((draft) => draft.status === "failed")?.error}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {summary.synced > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={clearSynced}>
              Clear
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            onClick={retry}
            disabled={!online || syncing || (summary.pending + summary.failed) === 0}
          >
            <RefreshCw className={syncing ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            Retry
          </Button>
        </div>
      </div>
    </div>
  )
}
