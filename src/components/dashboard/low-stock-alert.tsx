import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import type { Part } from "@/lib/types"

interface Props {
  parts: Part[]
}

export function LowStockAlert({ parts }: Props) {
  const low = parts.filter((p) => p.quantity_on_hand <= p.min_threshold)

  if (low.length === 0) return null

  return (
    <div className="rounded-lg border border-warning bg-warning-subtle">
      <div className="flex items-center gap-2 border-b border-warning/40 px-4 py-2.5">
        <AlertTriangle className="h-4 w-4 text-warning-strong" />
        <h3 className="text-sm font-semibold text-warning-strong">
          {low.length} Part{low.length > 1 ? "s" : ""} Low Stock
        </h3>
      </div>
      <div className="divide-y divide-warning/20">
        {low.map((part) => (
          <Link
            key={part.id}
            href="/parts"
            className="flex items-center justify-between gap-3 px-4 py-2 hover:bg-warning/10"
          >
            <span className="truncate text-sm font-medium text-warning-strong">{part.name}</span>
            <span className="shrink-0 text-xs text-warning-strong">
              {part.quantity_on_hand} / min {part.min_threshold}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
