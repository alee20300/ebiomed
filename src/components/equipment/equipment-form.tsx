"use client"

import { useSearchParams } from "next/navigation"
import { createEquipment, updateEquipment } from "@/lib/actions/equipment"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import type { Equipment } from "@/lib/types"

interface Props {
  equipment?: Equipment
  onCancel?: () => void
  hideCancel?: boolean
}

export function EquipmentForm({ equipment, onCancel, hideCancel }: Props) {
  const searchParams = useSearchParams()
  const error = searchParams.get("error")

  return (
    <form action={equipment ? updateEquipment.bind(null, equipment.id) : createEquipment} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="tag_number">Tag Number *</Label>
          <Input
            id="tag_number"
            name="tag_number"
            defaultValue={equipment?.tag_number}
            required
          />
        </div>
        <div>
          <Label htmlFor="name">Equipment Name *</Label>
          <Input
            id="name"
            name="name"
            defaultValue={equipment?.name}
            required
          />
        </div>
        <div>
          <Label htmlFor="serial_number">Serial Number</Label>
          <Input
            id="serial_number"
            name="serial_number"
            defaultValue={equipment?.serial_number || ""}
          />
        </div>
        <div>
          <Label htmlFor="model">Model</Label>
          <Input
            id="model"
            name="model"
            defaultValue={equipment?.model || ""}
          />
        </div>
        <div>
          <Label htmlFor="manufacturer">Manufacturer</Label>
          <Input
            id="manufacturer"
            name="manufacturer"
            defaultValue={equipment?.manufacturer || ""}
          />
        </div>
        <div>
          <Label htmlFor="category">Category</Label>
          <Input
            id="category"
            name="category"
            defaultValue={equipment?.category || ""}
          />
        </div>
        <div>
          <Label htmlFor="department">Department</Label>
          <Input
            id="department"
            name="department"
            defaultValue={equipment?.department || ""}
          />
        </div>
        <div>
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            name="location"
            defaultValue={equipment?.location || ""}
          />
        </div>
        <div>
          <Label htmlFor="status">Status</Label>
          <Select name="status" defaultValue={equipment?.status || "active"}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="retired">Retired</SelectItem>
              <SelectItem value="under_repair">Under Repair</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="install_date">Install Date</Label>
          <Input
            id="install_date"
            name="install_date"
            type="date"
            defaultValue={equipment?.install_date || ""}
          />
        </div>
        <div>
          <Label htmlFor="warranty_expiry">Warranty Expiry</Label>
          <Input
            id="warranty_expiry"
            name="warranty_expiry"
            type="date"
            defaultValue={equipment?.warranty_expiry || ""}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={equipment?.notes || ""}
        />
      </div>

      <div className="flex gap-3">
        <Button type="submit">
          {equipment ? "Update Equipment" : "Create Equipment"}
        </Button>
        {!hideCancel && (
          <Button variant="outline" type="button" onClick={() => onCancel?.() || history.back()}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  )
}
