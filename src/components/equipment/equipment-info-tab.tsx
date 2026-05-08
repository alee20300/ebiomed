import { StatusBadge } from "@/components/shared/status-badge"
import { formatDate } from "@/lib/utils/format"
import type { Equipment } from "@/lib/types"

export function EquipmentInfoTab({ equipment }: { equipment: Equipment }) {
  return (
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
  )
}
