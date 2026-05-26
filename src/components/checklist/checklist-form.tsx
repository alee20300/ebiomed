"use client"

import { useState } from "react"
import { submitChecklist } from "@/lib/actions/checklist"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { AlertCircle, ChevronLeft, Check, X } from "lucide-react"
import type { ChecklistItem } from "@/lib/types"

interface Props {
  equipmentId: string
  templateId: string | null
  templateName: string
  items: ChecklistItem[]
}

export function ChecklistForm({ equipmentId, templateId, templateName, items }: Props) {
  const [checkedItems, setCheckedItems] = useState<Record<string, "ok" | "not_ok">>({})

  const hasCheckedAll = Object.keys(checkedItems).length === items.length
  const failedCount = Object.values(checkedItems).filter((v) => v === "not_ok").length

  const toggleItem = (itemId: string, value: "ok" | "not_ok") => {
    setCheckedItems((prev) => ({ ...prev, [itemId]: value }))
  }

  const itemsData = items.map((item) => ({
    id: item.id,
    text: item.text,
    status: checkedItems[item.id] || "ok" as const,
  }))

  return (
    <form action={submitChecklist} className="space-y-6">
      <input type="hidden" name="equipment_id" value={equipmentId} />
      <input type="hidden" name="template_id" value={templateId || ""} />
      <input type="hidden" name="items" value={JSON.stringify(itemsData)} />

      <div>
        <p className="text-sm font-medium text-gray-500">{templateName}</p>
        <p className="text-xs text-gray-400">Mark each item as OK or Not OK</p>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="flex items-center rounded-lg border bg-white p-3">
            <span className="flex-1 text-sm">{item.text}</span>
            <div className="ml-3 flex gap-2">
              <button
                type="button"
                onClick={() => toggleItem(item.id, "ok")}
                className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors ${
                  checkedItems[item.id] === "ok"
                    ? "border-green-500 bg-green-50 text-green-600"
                    : "border-gray-200 text-gray-300 hover:border-green-300"
                }`}
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => toggleItem(item.id, "not_ok")}
                className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors ${
                  checkedItems[item.id] === "not_ok"
                    ? "border-red-500 bg-red-50 text-red-600"
                    : "border-gray-200 text-gray-300 hover:border-red-300"
                }`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
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

      <Button type="submit" className="w-full" size="lg" disabled={!hasCheckedAll}>
        {hasCheckedAll ? "Submit Checklist" : "Mark all items before submitting"}
      </Button>
    </form>
  )
}
