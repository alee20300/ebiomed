"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Home, Wrench, ClipboardList, CalendarCheck, Package } from "lucide-react"

const BOTTOM_ITEMS = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/equipment", label: "Equip", icon: Wrench },
  { href: "/work-orders", label: "WOs", icon: ClipboardList },
  { href: "/pm-schedules", label: "PMs", icon: CalendarCheck },
  { href: "/parts", label: "Parts", icon: Package },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 border-t bg-white lg:hidden">
      {BOTTOM_ITEMS.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 text-xs font-medium",
              isActive ? "text-primary" : "text-gray-500"
            )}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
