"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { createPMSchedule } from "@/lib/actions/pm-schedules"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import type { Equipment } from "@/lib/types"

export function PMScheduleForm() {
  const searchParams = useSearchParams()
  const error = searchParams.get("error")
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const supabase = createClient()

  useEffect(() => {
    supabase
      .from("equipment")
      .select("*")
      .eq("status", "active")
      .order("name")
      .then(({ data }) => setEquipment((data || []) as Equipment[]))
  }, [supabase])

  return (
    <form action={createPMSchedule} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div>
        <Label htmlFor="equipment_id">Equipment *</Label>
        <Select name="equipment_id">
          <SelectTrigger>
            <SelectValue placeholder="Select equipment..." />
          </SelectTrigger>
          <SelectContent>
            {equipment.map((eq) => (
              <SelectItem key={eq.id} value={eq.id}>
                {eq.tag_number} — {eq.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="frequency_days">Frequency (days) *</Label>
        <Input
          id="frequency_days"
          name="frequency_days"
          type="number"
          min={1}
          required
          placeholder="e.g. 30"
        />
      </div>

      <div>
        <Label htmlFor="active">Active</Label>
        <Select name="active" defaultValue="true">
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">Yes</SelectItem>
            <SelectItem value="false">No</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          rows={4}
          placeholder="Describe the preventive maintenance task..."
        />
      </div>

      <div>
        <Label htmlFor="checklist">Checklist Items (one per line)</Label>
        <Textarea
          id="checklist"
          name="checklist"
          rows={4}
          placeholder="Check oil level\nInspect belts\nClean filters"
        />
      </div>

      <div className="flex gap-3">
        <Button type="submit">
          Create PM Schedule
        </Button>
        <Button variant="outline" type="button" onClick={() => history.back()}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
