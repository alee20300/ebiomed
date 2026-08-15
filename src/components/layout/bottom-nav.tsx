"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Home, Menu, Wrench, ClipboardList, MessageSquareWarning, ClipboardCheck, Inbox, CalendarCheck, Package, ShoppingCart, BarChart3, Settings, FileSearch, Gauge } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

const PRIMARY_ITEMS = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/requests", label: "Reqs", icon: Inbox },
  { href: "/my-tasks", label: "Tasks", icon: ClipboardCheck },
]

const MORE_ITEMS = [
  { href: "/complaints", label: "Complaints", icon: MessageSquareWarning },
  { href: "/equipment", label: "Equip", icon: Wrench },
  { href: "/work-orders", label: "WOs", icon: ClipboardList },
  { href: "/pm-schedules", label: "PM", icon: CalendarCheck },
  { href: "/parts", label: "Parts", icon: Package },
  { href: "/purchasing", label: "Purchasing", icon: ShoppingCart },
  { href: "/reference-standards", label: "Standards", icon: Gauge },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/audit-log", label: "Audit", icon: FileSearch },
  { href: "/settings", label: "Settings", icon: Settings },
]

const MORE_GROUPS = [
  { label: "Operations", hrefs: ["/equipment", "/complaints", "/work-orders", "/pm-schedules", "/parts"] },
  { label: "Supply", hrefs: ["/purchasing"] },
  { label: "Compliance", hrefs: ["/reference-standards", "/reports", "/audit-log"] },
  { label: "Admin", hrefs: ["/settings"] },
] as const

interface BottomNavProps {
  role?: string
}

export function BottomNav({ role = "viewer" }: BottomNavProps) {
  const pathname = usePathname()

  const primaryItems = PRIMARY_ITEMS.filter((item) => {
    if (role === "viewer") {
      return item.href === "/dashboard" || item.href === "/requests"
    }
    return true
  })
  const moreItems = MORE_ITEMS.filter((item) => role !== "viewer" || item.href === "/work-orders")
  const moreGroups = MORE_GROUPS.map((group) => ({
    ...group,
    items: group.hrefs.flatMap((href) => {
      const item = moreItems.find((candidate) => candidate.href === href)
      return item ? [item] : []
    }),
  })).filter((group) => group.items.length > 0)
  const moreActive = moreItems.some((item) => pathname === item.href || pathname.startsWith(item.href + "/"))

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 border-t bg-card lg:hidden">
      {primaryItems.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 text-xs",
              isActive ? "font-medium text-primary" : "text-muted-foreground"
            )}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </Link>
        )
      })}
      <Sheet>
        <SheetTrigger
          aria-label="Open more navigation"
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-1 text-xs",
            moreActive ? "font-medium text-primary" : "text-muted-foreground"
          )}
        >
          <Menu className="h-5 w-5" />
          More
        </SheetTrigger>
        <SheetContent side="bottom" className="max-h-[70vh] overflow-y-auto pb-6">
          <SheetHeader>
            <SheetTitle>More</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 px-4 pb-4">
            {moreGroups.map((group) => (
              <section key={group.label} className="space-y-2">
                <h3 className="text-xs font-medium uppercase text-muted-foreground">{group.label}</h3>
                <div className="grid grid-cols-2 gap-2">
                  {group.items.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "flex min-h-12 items-center gap-3 rounded-lg border px-3 text-sm",
                          isActive ? "border-primary bg-primary/[0.08] text-primary" : "text-foreground"
                        )}
                      >
                        <item.icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  )
}
