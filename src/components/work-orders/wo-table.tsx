import Link from "next/link"
import { StatusBadge } from "@/components/shared/status-badge"
import { PriorityBadge } from "@/components/shared/priority-badge"
import { formatDateTime, formatRelative } from "@/lib/utils/format"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { WorkOrder } from "@/lib/types"

interface Props {
  data: WorkOrder[]
}

export function WorkOrderTable({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-8 text-center text-gray-500">
        No work orders found. Create your first work order.
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Equipment</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((wo) => (
            <TableRow key={wo.id}>
              <TableCell>
                <Link
                  href={`/work-orders/${wo.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {wo.equipment?.name || "Unknown"}
                </Link>
              </TableCell>
              <TableCell className="text-xs uppercase text-gray-500">{wo.type}</TableCell>
              <TableCell>
                <PriorityBadge priority={wo.priority} />
              </TableCell>
              <TableCell>
                <StatusBadge status={wo.status} />
              </TableCell>
              <TableCell className="max-w-xs truncate">{wo.description}</TableCell>
              <TableCell className="text-xs text-gray-500">
                <span title={formatDateTime(wo.created_at)}>
                  {formatRelative(wo.created_at)}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
