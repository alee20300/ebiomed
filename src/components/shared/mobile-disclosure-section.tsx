import type { ReactNode } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

export function MobileDisclosureSection({
  title,
  summary,
  children,
  defaultOpen = false,
  className,
}: {
  title: string
  summary?: string
  children: ReactNode
  defaultOpen?: boolean
  className?: string
}) {
  return (
    <details
      className={cn("group rounded-lg border bg-white", className)}
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
        <span>
          <span className="block text-sm font-semibold text-foreground">{title}</span>
          {summary && <span className="block text-xs text-muted-foreground">{summary}</span>}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t px-4 py-4">{children}</div>
    </details>
  )
}
