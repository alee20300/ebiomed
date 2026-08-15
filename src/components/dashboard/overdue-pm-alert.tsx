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
    <div className="rounded-lg border border-danger bg-danger-subtle">
      <div className="flex items-center gap-2 border-b border-danger/40 px-4 py-2.5">
        <AlertTriangle className="h-4 w-4 text-danger-strong" />
        <h3 className="text-sm font-semibold text-danger-strong">
          {overdue.length} Overdue PM{overdue.length > 1 ? "s" : ""}
        </h3>
      </div>
      <div className="divide-y divide-danger/20">
        {overdue.map((pm) => (
          <Link
            key={pm.id}
            href={`/pm-schedules/${pm.id}`}
            className="flex items-center justify-between gap-3 px-4 py-2 hover:bg-danger/10"
          >
            <span className="truncate text-sm font-medium text-danger-strong">
              {pm.equipment?.name || "Unknown"}
            </span>
            <span className="shrink-0 text-xs text-danger-strong">
              Due: {formatDate(pm.next_due)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
