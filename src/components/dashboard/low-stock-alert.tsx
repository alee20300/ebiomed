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
    <div className="rounded-lg border border-yellow-200 bg-yellow-50">
      <div className="flex items-center gap-2 border-b border-yellow-200 px-6 py-3">
        <AlertTriangle className="h-5 w-5 text-yellow-600" />
        <h3 className="font-semibold text-yellow-800">
          {low.length} Part{low.length > 1 ? "s" : ""} Low Stock
        </h3>
      </div>
      <div className="divide-y divide-yellow-100">
        {low.map((part) => (
          <Link
            key={part.id}
            href="/parts"
            className="flex items-center justify-between px-6 py-3 hover:bg-yellow-100"
          >
            <span className="text-sm font-medium text-yellow-700">{part.name}</span>
            <span className="text-xs text-yellow-600">
              {part.quantity_on_hand} / min {part.min_threshold}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
