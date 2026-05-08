import Link from "next/link"
import { formatDate, getPMStatus } from "@/lib/utils/format"
import { AlertTriangle } from "lucide-react"
import type { PMSchedule } from "@/lib/types"

interface Props {
  schedules: PMSchedule[]
}

export function OverduePMAlert({ schedules }: Props) {
  const overdue = schedules.filter((pm) => getPMStatus(pm.next_due) === "overdue")

  if (overdue.length === 0) return null

  return (
    <div className="rounded-lg border border-red-200 bg-red-50">
      <div className="flex items-center gap-2 border-b border-red-200 px-6 py-3">
        <AlertTriangle className="h-5 w-5 text-red-600" />
        <h3 className="font-semibold text-red-800">
          {overdue.length} Overdue PM{overdue.length > 1 ? "s" : ""}
        </h3>
      </div>
      <div className="divide-y divide-red-100">
        {overdue.map((pm) => (
          <Link
            key={pm.id}
            href={`/pm-schedules/${pm.id}`}
            className="flex items-center justify-between px-6 py-3 hover:bg-red-100"
          >
            <span className="text-sm font-medium text-red-700">
              {pm.equipment?.name || "Unknown"}
            </span>
            <span className="text-xs text-red-500">
              Due: {formatDate(pm.next_due)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
