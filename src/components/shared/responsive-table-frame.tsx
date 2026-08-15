import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function ResponsiveTableFrame({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn("w-full min-w-0 overflow-hidden rounded-lg border bg-white", className)}>
      <div className="w-full overflow-x-auto">
        {children}
      </div>
    </div>
  )
}
