"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { getPMStatus, formatDate, statusColor } from "@/lib/utils/format"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { startPMTask } from "@/lib/actions/pm-schedules"
import type { PMSchedule, ChecklistItem } from "@/lib/types"

interface Props {
  pmSchedule: PMSchedule
}

export function PMDetailCard({ pmSchedule }: Props) {
  const supabase = createClient()
  const [checklist, setChecklist] = useState<ChecklistItem[]>(pmSchedule.checklist || [])
  const [saving, setSaving] = useState(false)

  const status = getPMStatus(pmSchedule.next_due)

  async function toggleChecklistItem(index: number) {
    const updated = checklist.map((item, i) =>
      i === index ? { ...item, completed: !item.completed } : item
    )
    setChecklist(updated)
    setSaving(true)

    await supabase
      .from("pm_schedules")
      .update({ checklist: updated })
      .eq("id", pmSchedule.id)

    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Equipment</p>
          <p>{pmSchedule.equipment?.name || "Unknown"}</p>
          <p className="text-xs text-muted-foreground">{pmSchedule.equipment?.tag_number}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Frequency</p>
          <p>Every {pmSchedule.frequency_days} days</p>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Last Completed</p>
          <p>{formatDate(pmSchedule.last_completed)}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Next Due</p>
          <p>{formatDate(pmSchedule.next_due)}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Status</p>
          <Badge className={statusColor(status)}>
            {status === "overdue"
              ? "Overdue"
              : status === "due"
              ? "Due Today"
              : status === "upcoming"
              ? "Upcoming"
              : "OK"}
          </Badge>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Active</p>
          <p>{pmSchedule.active ? "Yes" : "No"}</p>
        </div>
      </div>

      {pmSchedule.description && (
        <div>
          <p className="text-sm font-medium text-muted-foreground">Description</p>
          <p className="whitespace-pre-wrap">{pmSchedule.description}</p>
        </div>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">Checklist</p>
          {saving && <span className="text-xs text-muted-foreground">Saving...</span>}
        </div>
        {checklist.length === 0 ? (
          <p className="text-sm text-muted-foreground">No checklist items.</p>
        ) : (
          <div className="space-y-2">
            {checklist.map((item, index) => (
              <div key={item.id} className="flex items-start gap-2">
                <Checkbox
                  id={`checklist-${item.id}`}
                  checked={item.completed}
                  onCheckedChange={() => toggleChecklistItem(index)}
                />
                <label
                  htmlFor={`checklist-${item.id}`}
                  className={`text-sm ${item.completed ? "line-through text-muted-foreground" : ""}`}
                >
                  {item.text}
                </label>
              </div>
            ))}
          </div>
        )}
      </div>

      {pmSchedule.active && status !== "none" && (
        <form action={startPMTask.bind(null, pmSchedule.id)}>
          <Button type="submit">Start PM</Button>
        </form>
      )}
    </div>
  )
}
