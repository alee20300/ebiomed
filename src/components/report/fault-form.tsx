"use client"

import { useSearchParams } from "next/navigation"
import { useState } from "react"
import { submitFaultReport } from "@/lib/actions/fault-report"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { AlertCircle, Camera } from "lucide-react"
import type { Equipment } from "@/lib/types"

interface Props {
  equipment: Equipment
  callLogEnabled: boolean
}

export function FaultForm({ equipment, callLogEnabled }: Props) {
  const searchParams = useSearchParams()
  const error = searchParams.get("error")
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [calledDepartment, setCalledDepartment] = useState<boolean | null>(null)

  return (
    <form action={submitFaultReport} className="space-y-6">
      {error && (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <input type="hidden" name="equipment_id" value={equipment.id} />
      <input type="hidden" name="equipment_tag" value={equipment.tag_number} />

      {callLogEnabled && (
        <>
          <input type="hidden" name="called_department" value={calledDepartment === true ? "true" : "false"} />
          <input type="hidden" name="call_status" value={calledDepartment ? "answered" : "unanswered"} />
        </>
      )}

      <Card>
        <CardContent className="flex items-center gap-4 p-4">
          <div>
            <p className="font-semibold">{equipment.name}</p>
            <p className="text-sm text-gray-500">Tag: {equipment.tag_number}</p>
            <p className="text-sm text-gray-500">{equipment.department} — {equipment.location}</p>
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
            required
            className="hidden"
            id="photo"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) setPhotoPreview(URL.createObjectURL(file))
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
                onClick={() => setPhotoPreview(null)}
              >
                Remove
              </Button>
            </div>
          ) : (
            <label htmlFor="photo" className="flex h-40 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 hover:border-primary">
              <Camera className="mb-2 h-8 w-8 text-gray-400" />
              <span className="text-sm text-gray-500">Tap to take photo</span>
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
          <Input id="reported_by_name" name="reported_by_name" />
        </div>
        <div>
          <Label htmlFor="reported_by_department">Department (optional)</Label>
          <Input id="reported_by_department" name="reported_by_department" />
        </div>
      </div>

      {callLogEnabled && (
        <div className="space-y-3 rounded-lg border bg-gray-50 p-4">
          <p className="text-sm font-medium">Call Log</p>

          <fieldset>
            <legend className="text-sm mb-2">Did you call the biomedical department?</legend>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="called_department_radio"
                  value="yes"
                  checked={calledDepartment === true}
                  onChange={() => setCalledDepartment(true)}
                  className="h-4 w-4"
                />
                <span className="text-sm">Yes</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="called_department_radio"
                  value="no"
                  checked={calledDepartment === false}
                  onChange={() => setCalledDepartment(false)}
                  className="h-4 w-4"
                />
                <span className="text-sm">No</span>
              </label>
            </div>
          </fieldset>

          {calledDepartment === true && (
            <div>
              <Label htmlFor="answered_by">Technician who answered</Label>
              <Input
                id="answered_by"
                name="answered_by"
                required
                placeholder="Enter the technician's name..."
              />
            </div>
          )}

          {calledDepartment === false && (
            <p className="text-sm text-orange-600">Recorded as unanswered.</p>
          )}
        </div>
      )}

      <Button type="submit" className="w-full" size="lg">
        Submit Fault Report
      </Button>
    </form>
  )
}
