"use client"

import { useState } from "react"
import { EquipmentForm } from "@/components/equipment/equipment-form"
import { StatusBadge } from "@/components/shared/status-badge"
import { formatDate } from "@/lib/utils/format"
import { Button } from "@/components/ui/button"
import { Pencil } from "lucide-react"
import type { Equipment } from "@/lib/types"

export function EquipmentInfoTab({ equipment }: { equipment: Equipment }) {
  const [editing, setEditing] = useState(false)

  if (editing) {
    return (
      <EquipmentForm equipment={equipment} onCancel={() => setEditing(false)} hideCancel />
    )
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          <Pencil className="mr-1 h-3 w-3" />
          Edit
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-sm font-medium text-gray-500">Tag Number</p>
          <p>{equipment.tag_number}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500">Name</p>
          <p>{equipment.name}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500">Serial Number</p>
          <p>{equipment.serial_number || "—"}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500">Model</p>
          <p>{equipment.model || "—"}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500">Manufacturer</p>
          <p>{equipment.manufacturer || "—"}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500">Category</p>
          <p>{equipment.category || "—"}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500">Department</p>
          <p>{equipment.department || "—"}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500">Location</p>
          <p>{equipment.location || "—"}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500">Status</p>
          <StatusBadge status={equipment.status} />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500">Install Date</p>
          <p>{formatDate(equipment.install_date)}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500">Warranty Expiry</p>
          <p>{formatDate(equipment.warranty_expiry)}</p>
        </div>
        {equipment.notes && (
          <div className="sm:col-span-2">
            <p className="text-sm font-medium text-gray-500">Notes</p>
            <p className="whitespace-pre-wrap">{equipment.notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}
