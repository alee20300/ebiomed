import Link from "next/link"
import type { ComponentType } from "react"

import { cn } from "@/lib/utils"

export type KpiTone = "amber" | "blue" | "violet" | "green" | "red"

const toneClasses: Record<KpiTone, { accent: string; icon: string }> = {
  amber: {
    accent: "border-t-[#F59E0B]",
    icon: "bg-[#FFF7E6] text-[#B77900] ring-[#F59E0B]/15",
  },
  blue: {
    accent: "border-t-[#2F6FED]",
    icon: "bg-[#EFF6FF] text-[#2563EB] ring-[#2F6FED]/15",
  },
  violet: {
    accent: "border-t-[#7C3AED]",
    icon: "bg-[#F5F3FF] text-[#6D28D9] ring-[#7C3AED]/15",
  },
  green: {
    accent: "border-t-[#2DA44E]",
    icon: "bg-[#ECFDF3] text-[#16833A] ring-[#2DA44E]/15",
  },
  red: {
    accent: "border-t-[#EF4438]",
    icon: "bg-[#FEF3F2] text-[#D92D20] ring-[#EF4438]/15",
  },
}

type KpiCardProps = {
  title: string
  value: string | number
  description: string
  icon: ComponentType<{ className?: string }>
  tone?: KpiTone
  size?: "default" | "compact"
  href?: string
  onClick?: () => void
  className?: string
}

export function KpiCard({
  title,
  value,
  description,
  icon: Icon,
  tone = "blue",
  size = "default",
  href,
  onClick,
  className,
}: KpiCardProps) {
  const classes = cn(
    "group rounded-xl border border-t-4 border-[#E1E6ED] bg-card text-left shadow-[0_2px_6px_rgba(16,24,40,0.05)] transition-all duration-150",
    size === "compact" ? "min-h-[128px] p-3.5" : "min-h-[176px] p-5",
    "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
    (href || onClick) && "cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(16,24,40,0.08)]",
    toneClasses[tone].accent,
    className
  )
  const content = (
    <>
      <div className={cn("flex items-center", size === "compact" ? "gap-3" : "gap-5")}>
        <span className={cn("flex shrink-0 items-center justify-center rounded-xl ring-1", size === "compact" ? "size-10" : "size-14", toneClasses[tone].icon)}>
          <Icon className={cn(size === "compact" ? "h-5 w-5" : "h-6 w-6")} />
        </span>
        <span className={cn("font-bold leading-none text-foreground", size === "compact" ? "text-3xl" : "text-4xl")}>{value}</span>
      </div>
      <div className={cn("space-y-1.5", size === "compact" ? "mt-5" : "mt-8")}>
        <p className={cn("font-semibold leading-tight text-foreground", size === "compact" ? "text-sm" : "text-lg")}>{title}</p>
        <p className={cn("leading-5 text-muted-foreground", size === "compact" ? "text-xs" : "text-sm")}>{description}</p>
      </div>
    </>
  )

  if (href) {
    return (
      <Link href={href} className={classes} aria-label={`${title}: ${value}. ${description}`}>
        {content}
      </Link>
    )
  }

  if (onClick) {
    return (
      <button type="button" className={classes} onClick={onClick} aria-label={`${title}: ${value}. ${description}`}>
        {content}
      </button>
    )
  }

  return <div className={classes}>{content}</div>
}
