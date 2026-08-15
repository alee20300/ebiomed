"use client"

import { useSearchParams } from "next/navigation"
import { type FormEvent, useState } from "react"
import { submitFaultReport } from "@/lib/actions/fault-report"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { AlertCircle, Camera } from "lucide-react"
import type { Equipment } from "@/lib/types"

interface Props {
  equipment: Equipment
  callLogEnabled: boolean
  biomedicalEngineers: Array<{
    id: string
    full_name: string
  }>
  reporterDefaults?: {
    name: string
    department: string
    email: string
  }
}

export function FaultForm({ equipment, callLogEnabled, biomedicalEngineers, reporterDefaults }: Props) {
  const searchParams = useSearchParams()
  const error = searchParams.get("error")
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const formData = new FormData(event.currentTarget)
    const photo = formData.get("photo")
    const description = formData.get("description")?.toString().trim() ?? ""
    const answeredBy = formData.get("answered_by")?.toString() ?? ""
    const callStatus = formData.get("call_status")?.toString() ?? ""

    let message: string | null = null
    let focusTarget: string | null = null

    if (!(photo instanceof File) || photo.size === 0) {
      message = "Please take or choose a photo of the equipment issue before submitting."
      focusTarget = "photo-dropzone"
    } else if (description.length < 10) {
      message = "Please describe the issue using at least 10 characters."
      focusTarget = "description"
    } else if (callLogEnabled && !answeredBy) {
      message = "Please select the biomedical engineer who was called."
      focusTarget = "answered_by"
    } else if (callLogEnabled && !callStatus) {
      message = "Please select whether the engineer was informed or did not pick up."
      focusTarget = "call_status"
    }

    if (!message) {
      setValidationError(null)
      return
    }

    event.preventDefault()
    setValidationError(message)
    requestAnimationFrame(() => {
      document.getElementById(focusTarget ?? "")?.focus()
    })
  }

  return (
    <form action={submitFaultReport} className="space-y-6" noValidate onSubmit={handleSubmit}>
      {(error || validationError) && (
        <div className="flex items-center gap-2 rounded-md border border-danger bg-danger-subtle p-3 text-sm text-danger-strong">
          <AlertCircle className="h-4 w-4" />
          {validationError || error}
        </div>
      )}

      <input type="hidden" name="equipment_id" value={equipment.id} />
      <input type="hidden" name="equipment_tag" value={equipment.tag_number} />

      {callLogEnabled && (
        <input type="hidden" name="called_department" value="true" />
      )}

      <Card>
        <CardContent className="flex items-center gap-4 p-4">
          <div>
            <p className="font-semibold">{equipment.name}</p>
            <p className="text-sm text-muted-foreground">Tag: {equipment.tag_number}</p>
            <p className="text-sm text-muted-foreground">{equipment.department} — {equipment.location}</p>
          </div>
          <StatusBadge status={equipment.status} className="ml-auto" />
        </CardContent>
      </Card>

      <div>
        <Label htmlFor="photo">Photo of Issue *</Label>
        <div className="mt-2">
          <input
            type="file"
            name="photo"
            accept="image/*"
            capture="environment"
            className="hidden"
            id="photo"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) {
                setPhotoPreview(URL.createObjectURL(file))
                setValidationError(null)
              }
            }}
          />
          {photoPreview ? (
            <div className="relative">
              <img src={photoPreview} alt="Preview" className="max-h-64 rounded-lg object-cover" />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="absolute right-2 top-2"
                onClick={() => {
                  const input = document.getElementById("photo") as HTMLInputElement | null
                  if (input) input.value = ""
                  setPhotoPreview(null)
                }}
              >
                Remove
              </Button>
            </div>
          ) : (
            <label id="photo-dropzone" tabIndex={-1} htmlFor="photo" className="flex h-40 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-input hover:border-primary focus:border-danger focus:outline-none">
              <Camera className="mb-2 h-8 w-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Tap to take photo</span>
            </label>
          )}
        </div>
      </div>

      <div>
        <Label htmlFor="description">Describe the Issue *</Label>
        <Textarea
          id="description"
          name="description"
          rows={4}
          required
          minLength={10}
          placeholder="Describe what's wrong with the equipment..."
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="reported_by_name">Your Name (optional)</Label>
          <Input
            id="reported_by_name"
            name="reported_by_name"
            defaultValue={reporterDefaults?.name}
          />
        </div>
        <div>
          <Label htmlFor="reported_by_department">Department (optional)</Label>
          <Input
            id="reported_by_department"
            name="reported_by_department"
            defaultValue={reporterDefaults?.department}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="requester_email">Email for Status Updates (optional)</Label>
        <Input
          id="requester_email"
          name="requester_email"
          type="email"
          defaultValue={reporterDefaults?.email}
          placeholder="name@example.com"
        />
      </div>

      {callLogEnabled && (
        <div className="space-y-3 rounded-lg border bg-muted p-4">
          <p className="text-sm font-medium">Call Log</p>
          <p className="text-sm text-muted-foreground">
            Record which on-call biomedical engineer was contacted and whether the call was received.
          </p>

          <div>
            <Label htmlFor="answered_by">Biomedical engineer called *</Label>
            <Select name="answered_by">
              <SelectTrigger id="answered_by">
                <SelectValue placeholder="Select an engineer..." />
              </SelectTrigger>
              <SelectContent>
                {biomedicalEngineers.map((engineer) => (
                  <SelectItem key={engineer.id} value={engineer.full_name}>
                    {engineer.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {biomedicalEngineers.length === 0 && (
              <p className="mt-1 text-xs text-warning-strong">No biomedical engineers are available in the user directory.</p>
            )}
          </div>

          <div>
            <Label htmlFor="call_status">Call status *</Label>
            <Select name="call_status">
              <SelectTrigger id="call_status">
                <SelectValue placeholder="Select call status..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="informed">Informed</SelectItem>
                <SelectItem value="not_picked">Not picked</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <Button type="submit" className="w-full" size="lg">
        Submit Fault Report
      </Button>
    </form>
  )
}
