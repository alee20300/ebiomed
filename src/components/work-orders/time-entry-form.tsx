"use client"

import { useState } from "react"
import { Clock, Plus } from "lucide-react"
import { addJobCardEntry } from "@/lib/actions/job-cards"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { enqueueOfflineDraft, type JobCardEntryDraftPayload } from "@/lib/offline/work-order-drafts"

const QUICK_DURATIONS = [15, 30, 60, 120]

function toDateTimeLocal(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60 * 1000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}

function getDefaultTimes(minutes: number) {
  const ended = new Date()
  const started = new Date(ended.getTime() - minutes * 60 * 1000)
  return {
    startedAt: toDateTimeLocal(started),
    endedAt: toDateTimeLocal(ended),
  }
}

export function TimeEntryForm({ jobCardId, workOrderId }: { jobCardId: string; workOrderId: string }) {
  const [open, setOpen] = useState(false)
  const [duration, setDuration] = useState(30)
  const [times, setTimes] = useState(() => getDefaultTimes(30))
  const [message, setMessage] = useState("")

  const applyDuration = (minutes: number) => {
    setDuration(minutes)
    setTimes(getDefaultTimes(minutes))
  }

  if (!open) {
    return (
      <div className="space-y-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            applyDuration(duration)
            setOpen(true)
          }}
          className="w-full sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          Add Time Entry
        </Button>
        {message && <p className="text-xs text-muted-foreground">{message}</p>}
      </div>
    )
  }

  return (
    <form
      action={async (fd) => {
        setMessage("")
        if (!navigator.onLine) {
          const payload: JobCardEntryDraftPayload = {
            workOrderId,
            jobCardId,
            description: String(fd.get("description") || ""),
            startedAt: String(fd.get("started_at") || ""),
            endedAt: String(fd.get("ended_at") || ""),
          }
          await enqueueOfflineDraft("job_card_entry", workOrderId, payload)
          setMessage("Offline time entry saved.")
          setOpen(false)
          return
        }
        await addJobCardEntry(jobCardId, fd)
        setOpen(false)
      }}
      className="space-y-4 rounded-lg border bg-muted/20 p-3"
    >
      <div>
        <Label htmlFor={`description-${jobCardId}`}>Work Performed</Label>
        <Textarea
          id={`description-${jobCardId}`}
          name="description"
          required
          rows={2}
          className="mt-1"
          placeholder="Diagnosis, repair, testing, handover..."
        />
      </div>

      <div className="space-y-2">
        <Label>Quick Duration</Label>
        <div className="grid grid-cols-4 gap-2">
          {QUICK_DURATIONS.map((minutes) => (
            <Button
              key={minutes}
              type="button"
              variant={duration === minutes ? "default" : "outline"}
              size="sm"
              onClick={() => applyDuration(minutes)}
              className="h-9"
            >
              {minutes < 60 ? `${minutes}m` : `${minutes / 60}h`}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={`started-at-${jobCardId}`}>Start Time</Label>
          <Input
            id={`started-at-${jobCardId}`}
            name="started_at"
            type="datetime-local"
            required
            className="mt-1"
            value={times.startedAt}
            onChange={(event) => setTimes((current) => ({ ...current, startedAt: event.target.value }))}
          />
        </div>
        <div>
          <Label htmlFor={`ended-at-${jobCardId}`}>End Time</Label>
          <Input
            id={`ended-at-${jobCardId}`}
            name="ended_at"
            type="datetime-local"
            required
            className="mt-1"
            value={times.endedAt}
            onChange={(event) => setTimes((current) => ({ ...current, endedAt: event.target.value }))}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" size="sm" className="w-full sm:w-auto">
          <Clock className="h-4 w-4" />
          Save Entry
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)} className="w-full sm:w-auto">
          Cancel
        </Button>
      </div>
      {message && <p className="text-xs text-muted-foreground">{message}</p>}
    </form>
  )
}
