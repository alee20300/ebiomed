"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { NAV_ITEMS } from "@/lib/utils/constants"
import {
  LayoutDashboard, Wrench, ClipboardList, CalendarCheck,
  Package, BarChart3, Settings, ClipboardCheck
} from "lucide-react"

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, Wrench, ClipboardList, CalendarCheck, Package, BarChart3, Settings, ClipboardCheck,
}

interface SidebarProps {
  role?: string
}

export function Sidebar({ role = "viewer" }: SidebarProps) {
  const pathname = usePathname()

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (role === "viewer" && item.href === "/settings") return false
    return true
  })

  return (
    <aside className="hidden h-screen w-64 flex-col border-r bg-card lg:flex">
      <div className="px-4 py-6">
        <Link href="/dashboard" className="px-2 text-xl font-bold text-primary">
          eBiomed
        </Link>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-4 py-4">
        {visibleItems.map((item) => {
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
      </nav>
    </aside>
  )
}
