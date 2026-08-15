import { cn } from "@/lib/utils/cn"
import { Badge } from "@/components/ui/badge"
import { statusColor } from "@/lib/utils/format"

interface Props {
  status: string
  className?: string
}

export function StatusBadge({ status, className }: Props) {
  return (
    <Badge
      className={cn(
        "capitalize",
        statusColor(status),
        className
      )}
    >
      {status.replace("_", " ")}
    </Badge>
  )
}
