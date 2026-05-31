import Link from "next/link"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import type { Complaint } from "@/lib/types"

export function ComplaintTable({ complaints }: { complaints: Complaint[] }) {
  if (complaints.length === 0) {
    return <p className="py-8 text-center text-sm text-gray-500">No pending complaints.</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Equipment</TableHead>
          <TableHead>Tag</TableHead>
          <TableHead>Reported By</TableHead>
          <TableHead>Department</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Description</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {complaints.map((c) => (
          <TableRow key={c.id}>
            <TableCell>
              <Link href={`/complaints/${c.id}`} className="font-medium text-blue-600 hover:underline">
                {c.equipment?.name || "Unknown"}
              </Link>
            </TableCell>
            <TableCell className="font-mono text-sm">{c.equipment?.tag_number || "-"}</TableCell>
            <TableCell>{c.reported_by_name || "-"}</TableCell>
            <TableCell>{c.reported_by_department || "-"}</TableCell>
            <TableCell className="text-sm text-gray-500">
              {new Date(c.created_at).toLocaleDateString()}
            </TableCell>
            <TableCell className="max-w-xs truncate text-sm">{c.description}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
