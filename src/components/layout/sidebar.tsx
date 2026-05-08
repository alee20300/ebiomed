"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { NAV_ITEMS } from "@/lib/utils/constants"
import {
  LayoutDashboard, Wrench, ClipboardList, CalendarCheck,
  Package, BarChart3, Settings
} from "lucide-react"

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, Wrench, ClipboardList, CalendarCheck, Package, BarChart3, Settings,
}

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden h-screen w-64 flex-col border-r bg-white lg:flex">
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/dashboard" className="text-xl font-bold text-primary">
          eBiomed
        </Link>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {NAV_ITEMS.map((item) => {
          const Icon = iconMap[item.icon]
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
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
