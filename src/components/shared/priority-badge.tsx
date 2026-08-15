import { cn } from "@/lib/utils/cn"
import { Badge } from "@/components/ui/badge"
import { priorityColor } from "@/lib/utils/format"

interface Props {
  priority: string
  className?: string
}

export function PriorityBadge({ priority, className }: Props) {
  return (
    <Badge
      className={cn(
        "capitalize",
        priorityColor(priority),
        className
      )}
    >
      {priority}
    </Badge>
  )
}
