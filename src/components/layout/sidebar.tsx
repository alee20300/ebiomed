"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { NAV_ITEMS } from "@/lib/utils/constants"
import {
  LayoutDashboard, Wrench, ClipboardList, CalendarCheck,
  Package, BarChart3, Settings, ClipboardCheck, FileSearch, Gauge, MessageSquareWarning, ScanLine, ShoppingCart, Inbox, ChevronDown
} from "lucide-react"

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, Wrench, ClipboardList, CalendarCheck, Package, BarChart3, Settings, ClipboardCheck, FileSearch, Gauge, MessageSquareWarning, ScanLine, ShoppingCart, Inbox,
}

const PRIMARY_HREFS = [
  "/dashboard",
  "/requests",
  "/my-tasks",
  "/equipment",
] as const

const SECONDARY_GROUPS = [
  {
    label: "Operations",
    icon: ClipboardList,
    hrefs: ["/complaints", "/work-orders", "/pm-schedules", "/parts"],
  },
  {
    label: "Purchasing",
    icon: ShoppingCart,
    hrefs: ["/purchasing"],
  },
  {
    label: "Compliance",
    icon: Gauge,
    hrefs: ["/reference-standards", "/reports", "/audit-log"],
  },
  {
    label: "Admin",
    icon: Settings,
    hrefs: ["/settings"],
  },
] as const

interface SidebarProps {
  role?: string
}

export function Sidebar({ role = "viewer" }: SidebarProps) {
  const pathname = usePathname()

  const visibleItems = NAV_ITEMS.filter((item) => {
    // Viewer: dashboard, requests, and work-orders only
    if (role === "viewer") {
      return item.href === "/dashboard" || item.href === "/requests" || item.href === "/work-orders"
    }
    return true
  })
  const primaryItems = visibleItems.filter((item) => PRIMARY_HREFS.includes(item.href as typeof PRIMARY_HREFS[number]))
  const groupedItems = SECONDARY_GROUPS.map((group) => ({
    ...group,
    items: group.hrefs.flatMap((href) => {
      const item = visibleItems.find((candidate) => candidate.href === href)
      return item ? [item] : []
    }),
  })).filter((group) => group.items.length > 0)

  return (
    <aside className="hidden h-screen w-64 shrink-0 flex-col border-r bg-card lg:flex">
      <div className="shrink-0 px-4 py-6">
        <Link href="/dashboard" className="px-2 text-xl font-bold text-primary">
          eBiomed
        </Link>
      </div>
      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-4 py-4">
        {primaryItems.map((item) => {
          const Icon = iconMap[item.icon]
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/[0.08] font-semibold text-primary"
                  : "text-muted-foreground hover:bg-background hover:text-foreground"
              )}
            >
              {Icon && <Icon className="h-5 w-5" />}
              {item.label}
            </Link>
          )
        })}
        {groupedItems.length > 0 && (
          <div className="mt-4 space-y-1 border-t pt-4">
            {groupedItems.map((group) => {
              const GroupIcon = group.icon
              const groupActive = group.items.some((item) => pathname === item.href || pathname.startsWith(item.href + "/"))
              return (
                <details key={group.label} open={groupActive} className="group">
                  <summary
                    className={cn(
                      "flex cursor-pointer list-none items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors",
                      groupActive
                        ? "bg-primary/[0.08] font-semibold text-primary"
                        : "text-muted-foreground hover:bg-background hover:text-foreground"
                    )}
                  >
                    <GroupIcon className="h-5 w-5" />
                    <span className="flex-1">{group.label}</span>
                    <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="mt-1 space-y-1 pl-8">
                    {group.items.map((item) => {
                      const Icon = iconMap[item.icon]
                      const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                            "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                            isActive
                              ? "bg-primary/[0.08] font-semibold text-primary"
                              : "text-muted-foreground hover:bg-background hover:text-foreground"
                          )}
                        >
                          {Icon && <Icon className="h-4 w-4" />}
                          {item.label}
                        </Link>
                      )
                    })}
                  </div>
                </details>
              )
            })}
          </div>
        )}
      </nav>
    </aside>
  )
}
