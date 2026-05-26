"use client"

import { useState } from "react"
import { submitChecklist } from "@/lib/actions/checklist"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { AlertCircle, Check, X } from "lucide-react"
import type { ChecklistItem } from "@/lib/types"

interface Props {
  equipmentId: string
  templateId: string | null
  templateName: string
  items: ChecklistItem[]
}

interface ItemResult {
  id: string
  text: string
  status: "ok" | "not_ok"
  value?: string
}

export function ChecklistForm({ equipmentId, templateId, templateName, items }: Props) {
  const [results, setResults] = useState<Record<string, ItemResult>>({})

  const allDone = items.every((item) => {
    const r = results[item.id]
    if (!r) return false
    if (item.type === "checkbox") return true
    if (item.type === "number") return r.value !== undefined && r.value !== ""
    if (item.type === "combobox") return r.value !== undefined && r.value !== ""
    return true
  })

  const failedCount = Object.values(results).filter((r) => r.status === "not_ok").length

  const setItemResult = (itemId: string, partial: Partial<ItemResult>) => {
    setResults((prev) => {
      const existing = prev[itemId] || { id: itemId, text: "", status: "ok" as const }
      return { ...prev, [itemId]: { ...existing, ...partial } }
    })
  }

  const itemsData: ItemResult[] = items.map((item) => ({
    id: item.id,
    text: item.text,
    status: results[item.id]?.status || "ok",
    value: results[item.id]?.value,
  }))

  return (
    <form action={submitChecklist} className="space-y-6">
      <input type="hidden" name="equipment_id" value={equipmentId} />
      <input type="hidden" name="template_id" value={templateId || ""} />
      <input type="hidden" name="items" value={JSON.stringify(itemsData)} />

      <div>
        <p className="text-sm font-medium text-gray-500">{templateName}</p>
        <p className="text-xs text-gray-400">
          {items.some((i) => i.type === "number" || i.type === "combobox")
            ? "Fill in each item below"
            : "Mark each item as OK or Not OK"}
        </p>
      </div>

      <div className="space-y-3">
        {items.map((item) => {
          const result = results[item.id]
          const fieldType = item.type || "checkbox"

          return (
            <div key={item.id} className="rounded-lg border bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm">
                  {item.text}
                  {item.required && <span className="ml-1 text-red-500 text-xs">*</span>}
                </span>
              </div>

              {fieldType === "checkbox" && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setItemResult(item.id, { status: "ok", text: item.text })}
                    className={`flex flex-1 items-center justify-center gap-1 rounded-lg border-2 py-2 text-sm transition-colors ${
                      result?.status === "ok"
                        ? "border-green-500 bg-green-50 text-green-700"
                        : "border-gray-200 text-gray-400 hover:border-green-300"
                    }`}
                  >
                    <Check className="h-4 w-4" /> OK
                  </button>
                  <button
                    type="button"
                    onClick={() => setItemResult(item.id, { status: "not_ok", text: item.text })}
                    className={`flex flex-1 items-center justify-center gap-1 rounded-lg border-2 py-2 text-sm transition-colors ${
                      result?.status === "not_ok"
                        ? "border-red-500 bg-red-50 text-red-700"
                        : "border-gray-200 text-gray-400 hover:border-red-300"
                    }`}
                  >
                    <X className="h-4 w-4" /> Not OK
                  </button>
                </div>
              )}

              {fieldType === "number" && (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="Enter value..."
                    value={result?.value || ""}
                    onChange={(e) =>
                      setItemResult(item.id, {
                        text: item.text,
                        value: e.target.value,
                        status: "ok",
                      })
                    }
                    className="h-9 flex-1 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setItemResult(item.id, {
                        text: item.text,
                        value: result?.value,
                        status: "not_ok",
                      })
                    }
                    className={`flex h-9 items-center gap-1 rounded-lg border-2 px-3 text-sm ${
                      result?.status === "not_ok"
                        ? "border-red-500 bg-red-50 text-red-700"
                        : "border-gray-200 text-gray-400 hover:border-red-300"
                    }`}
                  >
                    <X className="h-4 w-4" /> Flag
                  </button>
                </div>
              )}

              {fieldType === "combobox" && (
                <div className="flex items-center gap-2">
                  <select
                    value={result?.value || ""}
                    onChange={(e) =>
                      setItemResult(item.id, {
                        text: item.text,
                        value: e.target.value,
                        status: "ok",
                      })
                    }
                    className="h-9 flex-1 rounded-lg border border-input bg-card px-3 text-sm outline-none"
                  >
                    <option value="">Select...</option>
                    {(item.options || ["Good", "Fair", "Poor"]).map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      setItemResult(item.id, {
                        text: item.text,
                        value: result?.value,
                        status: "not_ok",
                      })
                    }
                    className={`flex h-9 items-center gap-1 rounded-lg border-2 px-3 text-sm ${
                      result?.status === "not_ok"
                        ? "border-red-500 bg-red-50 text-red-700"
                        : "border-gray-200 text-gray-400 hover:border-red-300"
                    }`}
                  >
                    <X className="h-4 w-4" /> Flag
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {failedCount > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertCircle className="h-4 w-4" />
          {failedCount} item{failedCount > 1 ? "s" : ""} flagged — a work order will be created
        </div>
      )}

      <div>
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea id="notes" name="notes" rows={2} placeholder="Any additional observations..." />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="submitted_by_name">Your Name (optional)</Label>
          <Input id="submitted_by_name" name="submitted_by_name" />
        </div>
        <div>
          <Label htmlFor="submitted_by_department">Department (optional)</Label>
          <Input id="submitted_by_department" name="submitted_by_department" />
        </div>
      </div>

      <Button type="submit" className="w-full" size="lg" disabled={!allDone}>
        {allDone ? "Submit Checklist" : "Complete all items before submitting"}
      </Button>
    </form>
  )
}
