import { cn } from "@/lib/utils/cn"
import { statusColor } from "@/lib/utils/format"

interface Props {
  status: string
  className?: string
}

export function StatusBadge({ status, className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize",
        statusColor(status),
        className
      )}
    >
      {status.replace("_", " ")}
    </span>
  )
}
