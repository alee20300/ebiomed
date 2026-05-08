import Link from "next/link"
import { StatusBadge } from "@/components/shared/status-badge"
import { formatDate } from "@/lib/utils/format"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import type { Equipment } from "@/lib/types"

interface Props {
  data: Equipment[]
}

export function EquipmentTable({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-8 text-center text-gray-500">
        No equipment found. Create your first equipment entry.
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tag #</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Manufacturer</TableHead>
            <TableHead>Department</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Installed</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((equip) => (
            <TableRow key={equip.id}>
              <TableCell>
                <Link
                  href={`/equipment/${equip.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {equip.tag_number}
                </Link>
              </TableCell>
              <TableCell>{equip.name}</TableCell>
              <TableCell>{equip.manufacturer || "—"}</TableCell>
              <TableCell>{equip.department || "—"}</TableCell>
              <TableCell>{equip.location || "—"}</TableCell>
              <TableCell>
                <StatusBadge status={equip.status} />
              </TableCell>
              <TableCell className="text-sm text-gray-500">
                {formatDate(equip.install_date)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
