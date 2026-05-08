import { cn } from "@/lib/utils/cn"
import { priorityColor } from "@/lib/utils/format"

interface Props {
  priority: string
  className?: string
}

export function PriorityBadge({ priority, className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize",
        priorityColor(priority),
        className
      )}
    >
      {priority}
    </span>
  )
}
