export type OfflineDraftStatus = "pending" | "syncing" | "failed" | "synced"

export type OfflineDraftType =
  | "work_order_status"
  | "job_card_entry"
  | "parts_usage"
  | "media_attachment"

export interface WorkOrderStatusDraftPayload {
  workOrderId: string
  status: string
  assignedTo: string | null
  resolutionNotes: string | null
  reason: string
  originalStatus: string
  originalAssignedTo: string | null
}

export interface JobCardEntryDraftPayload {
  workOrderId: string
  jobCardId: string
  description: string
  startedAt: string
  endedAt: string
}

export interface PartsUsageDraftPayload {
  workOrderId: string
  partId: string
  quantityUsed: number
  reason: string
}

export interface MediaAttachmentDraftPayload {
  workOrderId: string
  caption: string | null
  mediaType: "image" | "video"
  fileName: string
  mimeType: string
  size: number
  blob: Blob
}

export type OfflineDraftPayload =
  | WorkOrderStatusDraftPayload
  | JobCardEntryDraftPayload
  | PartsUsageDraftPayload
  | MediaAttachmentDraftPayload

export interface OfflineDraft<TPayload extends OfflineDraftPayload = OfflineDraftPayload> {
  id: string
  workOrderId: string
  type: OfflineDraftType
  status: OfflineDraftStatus
  payload: TPayload
  attempts: number
  error: string | null
  createdAt: string
  updatedAt: string
  syncedAt: string | null
}

export interface OfflineDraftSummary {
  pending: number
  syncing: number
  failed: number
  synced: number
  total: number
}

const DB_NAME = "ebiomed-offline"
const DB_VERSION = 1
const STORE_NAME = "workOrderDrafts"
export const OFFLINE_DRAFTS_EVENT = "ebiomed:offline-drafts"

function assertIndexedDb() {
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB is not available in this browser")
  }
}

function openOfflineDb(): Promise<IDBDatabase> {
  assertIndexedDb()
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" })
        store.createIndex("workOrderId", "workOrderId")
        store.createIndex("status", "status")
        store.createIndex("type", "type")
        store.createIndex("updatedAt", "updatedAt")
      }
    }

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
  })
}

async function withStore<T>(
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest<T> | void
): Promise<T | undefined> {
  const db = await openOfflineDb()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode)
    const store = transaction.objectStore(STORE_NAME)
    const request = callback(store)
    let result: T | undefined

    if (request) {
      request.onsuccess = () => {
        result = request.result
      }
      request.onerror = () => reject(request.error)
    }

    transaction.oncomplete = () => {
      db.close()
      resolve(result)
    }
    transaction.onerror = () => {
      db.close()
      reject(transaction.error)
    }
  })
}

export function emitOfflineDraftChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(OFFLINE_DRAFTS_EVENT))
  }
}

export function createOfflineDraft<TPayload extends OfflineDraftPayload>(
  type: OfflineDraftType,
  workOrderId: string,
  payload: TPayload,
  nowIso = new Date().toISOString()
): OfflineDraft<TPayload> {
  return {
    id: crypto.randomUUID(),
    workOrderId,
    type,
    status: "pending",
    payload,
    attempts: 0,
    error: null,
    createdAt: nowIso,
    updatedAt: nowIso,
    syncedAt: null,
  }
}

export function summarizeOfflineDrafts(drafts: OfflineDraft[]): OfflineDraftSummary {
  return drafts.reduce<OfflineDraftSummary>((summary, draft) => {
    summary[draft.status] += 1
    summary.total += 1
    return summary
  }, { pending: 0, syncing: 0, failed: 0, synced: 0, total: 0 })
}

export function isTerminalWorkOrderStatus(status: string) {
  return status === "completed" || status === "cancelled"
}

export async function enqueueOfflineDraft<TPayload extends OfflineDraftPayload>(
  type: OfflineDraftType,
  workOrderId: string,
  payload: TPayload
) {
  const draft = createOfflineDraft(type, workOrderId, payload)
  await withStore("readwrite", (store) => store.put(draft))
  emitOfflineDraftChange()
  return draft
}

export async function listOfflineDrafts(workOrderId?: string): Promise<OfflineDraft[]> {
  if (typeof indexedDB === "undefined") return []
  const drafts = await withStore<OfflineDraft[]>("readonly", (store) => {
    if (!workOrderId) return store.getAll()
    return store.index("workOrderId").getAll(workOrderId)
  })
  return (drafts || []).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export async function updateOfflineDraft(
  draft: OfflineDraft,
  updates: Partial<Pick<OfflineDraft, "status" | "attempts" | "error" | "syncedAt">>
) {
  const next: OfflineDraft = {
    ...draft,
    ...updates,
    updatedAt: new Date().toISOString(),
  }
  await withStore("readwrite", (store) => store.put(next))
  emitOfflineDraftChange()
  return next
}

export async function deleteOfflineDraft(id: string) {
  await withStore("readwrite", (store) => store.delete(id))
  emitOfflineDraftChange()
}

export function workOrderStatusDraftToFormData(payload: WorkOrderStatusDraftPayload) {
  const formData = new FormData()
  formData.set("status", payload.status)
  if (payload.assignedTo) formData.set("assigned_to", payload.assignedTo)
  if (payload.resolutionNotes) formData.set("resolution_notes", payload.resolutionNotes)
  formData.set("reason", payload.reason)
  return formData
}

export function jobCardEntryDraftToFormData(payload: JobCardEntryDraftPayload) {
  const formData = new FormData()
  formData.set("description", payload.description)
  formData.set("started_at", payload.startedAt)
  formData.set("ended_at", payload.endedAt)
  return formData
}

export function partsUsageDraftToFormData(payload: PartsUsageDraftPayload) {
  const formData = new FormData()
  formData.set("work_order_id", payload.workOrderId)
  formData.set("part_id", payload.partId)
  formData.set("quantity_used", String(payload.quantityUsed))
  formData.set("reason", payload.reason)
  return formData
}

export function mediaAttachmentDraftToFormData(payload: MediaAttachmentDraftPayload) {
  const formData = new FormData()
  formData.set("caption", payload.caption || "")
  formData.set("attachment", new File([payload.blob], payload.fileName, { type: payload.mimeType }))
  return formData
}
