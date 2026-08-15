"use client"

import { useMemo, useState } from "react"
import { AlertTriangle } from "lucide-react"

import { createAuthenticatedRequest } from "@/lib/actions/fault-report"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { StatusBadge } from "@/components/shared/status-badge"
import { Textarea } from "@/components/ui/textarea"
import type { Equipment } from "@/lib/types"

type RequestUser = {
  full_name?: string | null
  department?: string | null
  email?: string | null
}

export function NewRequestForm({
  equipment,
  user,
}: {
  equipment: Equipment[]
  user: RequestUser
}) {
  const [query, setQuery] = useState("")
  const [selectedId, setSelectedId] = useState("")
  const hasSearch = query.trim().length > 0
  const selectedEquipment = equipment.find((item) => item.id === selectedId)
  const filteredEquipment = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return []
    return equipment.filter((item) => [
      item.name,
      item.tag_number,
      item.department,
      item.location,
      item.manufacturer,
      item.model,
    ].some((value) => String(value || "").toLowerCase().includes(normalized))).slice(0, 25)
  }, [equipment, query])

  return (
    <form action={createAuthenticatedRequest} className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="space-y-3">
          <div>
            <Label htmlFor="equipment-search">Equipment</Label>
            <Input
              id="equipment-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search tag, name, department, location"
              className="mt-1"
            />
          </div>

          <div className="max-h-[28rem] space-y-2 overflow-y-auto rounded-lg border bg-card p-2">
            {!hasSearch && (
              <p className="p-4 text-center text-sm text-muted-foreground">
                Search by tag, equipment name, department, or location to select a device.
              </p>
            )}
            {filteredEquipment.map((item) => {
              const selected = item.id === selectedId
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={`w-full rounded-md border p-3 text-left transition-colors ${selected ? "border-primary bg-primary/[0.08]" : "bg-background hover:bg-muted/50"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.tag_number} · {item.department || "No department"}</p>
                      <p className="truncate text-xs text-muted-foreground">{item.location || "No location"}</p>
                    </div>
                    <StatusBadge status={item.status} />
                  </div>
                </button>
              )
            })}
            {hasSearch && filteredEquipment.length === 0 && (
              <p className="p-4 text-center text-sm text-muted-foreground">No equipment matches this search.</p>
            )}
          </div>
        </section>

        <section className="space-y-4 rounded-lg border bg-card p-4">
          <input type="hidden" name="equipment_id" value={selectedId} />
          <input type="hidden" name="equipment_tag" value={selectedEquipment?.tag_number || ""} />
          <input type="hidden" name="reason" value="Fault request created from app" />

          {selectedEquipment && (
            <div className="rounded-lg border bg-muted p-3">
              <p className="font-medium">{selectedEquipment.name}</p>
              <p className="text-sm text-muted-foreground">Tag: {selectedEquipment.tag_number}</p>
              <p className="text-sm text-muted-foreground">{selectedEquipment.department || "No department"} · {selectedEquipment.location || "No location"}</p>
            </div>
          )}

          <div>
            <Label htmlFor="description">Issue Description</Label>
            <Textarea
              id="description"
              name="description"
              rows={5}
              required
              minLength={10}
              placeholder="Describe the equipment issue, symptoms, and impact..."
              className="mt-1"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="urgency">Urgency</Label>
              <Select name="urgency" defaultValue="normal">
                <SelectTrigger id="urgency" className="mt-1 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="emergency">Emergency</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="patient_safety_risk">Safety Risk</Label>
              <Select name="patient_safety_risk" defaultValue="none">
                <SelectTrigger id="patient_safety_risk" className="mt-1 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="clinical_impact">Clinical Impact</Label>
              <Select name="clinical_impact" defaultValue="routine">
                <SelectTrigger id="clinical_impact" className="mt-1 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="routine">Routine</SelectItem>
                  <SelectItem value="care_delayed">Care Delayed</SelectItem>
                  <SelectItem value="patient_at_risk">Patient At Risk</SelectItem>
                  <SelectItem value="patient_harm">Patient Harm</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-lg border bg-muted p-3">
            <Checkbox id="patient_care_critical" name="patient_care_critical" />
            <Label htmlFor="patient_care_critical" className="text-sm">Patient care depends on this device</Label>
          </div>

          <div>
            <Label htmlFor="photo">Photo</Label>
            <Input id="photo" name="photo" type="file" accept="image/*" className="mt-1" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="reported_by_name">Reported By</Label>
              <Input id="reported_by_name" name="reported_by_name" defaultValue={user.full_name || ""} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="reported_by_department">Department</Label>
              <Input id="reported_by_department" name="reported_by_department" defaultValue={user.department || ""} className="mt-1" />
            </div>
          </div>

          <div>
            <Label htmlFor="requester_email">Status Email</Label>
            <Input id="requester_email" name="requester_email" type="email" defaultValue={user.email || ""} className="mt-1" />
          </div>

          {!selectedEquipment && (
            <div className="flex items-center gap-2 rounded-lg border border-danger bg-danger-subtle p-3 text-sm text-danger-strong">
              <AlertTriangle className="h-4 w-4" />
              Select equipment before submitting.
            </div>
          )}

          <Button type="submit" className="w-full" disabled={!selectedEquipment}>
            Submit Request
          </Button>
        </section>
      </div>
    </form>
  )
}
