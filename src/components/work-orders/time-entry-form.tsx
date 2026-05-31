"use client"

import { useState } from "react"
import { addJobCardEntry } from "@/lib/actions/job-cards"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export function TimeEntryForm({ jobCardId }: { jobCardId: string }) {
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        + Add Time Entry
      </Button>
    )
  }

  return (
    <form action={async (fd) => { await addJobCardEntry(jobCardId, fd); setOpen(false) }} className="space-y-3 rounded-lg border p-3">
      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" required className="mt-1" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="started_at">Start Time</Label>
          <Input id="started_at" name="started_at" type="datetime-local" required className="mt-1" />
        </div>
        <div>
          <Label htmlFor="ended_at">End Time</Label>
          <Input id="ended_at" name="ended_at" type="datetime-local" required className="mt-1" />
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm">Save Entry</Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  )
}
