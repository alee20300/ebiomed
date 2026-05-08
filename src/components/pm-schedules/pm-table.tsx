import Link from "next/link"
import { startPMTask } from "@/lib/actions/pm-schedules"
import { getPMStatus, formatDate } from "@/lib/utils/format"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { PMSchedule } from "@/lib/types"

interface Props {
  data: PMSchedule[]
}

export function PMTable({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-8 text-center text-gray-500">
        No PM schedules found.
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Equipment</TableHead>
            <TableHead>Frequency</TableHead>
            <TableHead>Last Completed</TableHead>
            <TableHead>Next Due</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((pm) => {
            const status = getPMStatus(pm.next_due)
            return (
              <TableRow key={pm.id}>
                <TableCell>
                  <Link href={`/pm-schedules/${pm.id}`} className="font-medium text-primary hover:underline">
                    {pm.equipment?.name || "Unknown"}
                  </Link>
                </TableCell>
                <TableCell>Every {pm.frequency_days} days</TableCell>
                <TableCell>{formatDate(pm.last_completed)}</TableCell>
                <TableCell>{formatDate(pm.next_due)}</TableCell>
                <TableCell>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    status === "overdue" ? "bg-red-100 text-red-800" :
                    status === "due" ? "bg-yellow-100 text-yellow-800" :
                    status === "upcoming" ? "bg-blue-100 text-blue-800" :
                    "bg-gray-100 text-gray-800"
                  }`}>
                    {status === "overdue" ? "Overdue" :
                     status === "due" ? "Due Today" :
                     status === "upcoming" ? "Upcoming" : "OK"}
                  </span>
                </TableCell>
                <TableCell>
                  {pm.active && status !== "none" && (
                    <form action={startPMTask.bind(null, pm.id)}>
                      <Button size="sm" type="submit">Start PM</Button>
                    </form>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
