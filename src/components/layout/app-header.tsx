import { signout, getCurrentUser } from "@/lib/actions/profiles"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Menu, ScanLine } from "lucide-react"
import Link from "next/link"
import { GlobalSearch } from "@/components/shared/global-search"
import { NotificationMenu } from "@/components/layout/notification-menu"

export async function AppHeader() {
  const user = await getCurrentUser()

  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-4 lg:px-8">
      <div className="flex items-center gap-4">
        <Menu className="h-6 w-6 lg:hidden" />
        <Link href="/dashboard" className="text-lg font-semibold lg:hidden">
          eBiomed
        </Link>
      </div>
      <div className="mx-4 hidden min-w-0 flex-1 md:block">
        <GlobalSearch
          size="compact"
          placeholder="Search assets, WOs, requests, PMs, parts..."
          className="mx-auto max-w-2xl"
        />
      </div>
      <div className="flex items-center gap-2">
        <Link href="/scan">
          <Button variant="outline" size="sm" className="h-8">
            <ScanLine className="h-4 w-4" />
            <span className="hidden sm:inline">Scan</span>
          </Button>
        </Link>
        <NotificationMenu />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" className="flex items-center gap-2" />}
          >
            <Avatar className="h-8 w-8">
              <AvatarFallback>
                {user?.full_name?.split(" ").map((n: string) => n[0]).join("").toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <span className="hidden text-sm font-medium md:block">{user?.full_name}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled className="text-xs text-muted-foreground">
              {user?.email}
            </DropdownMenuItem>
            <DropdownMenuItem>
              <form action={signout} className="w-full">
                <button type="submit" className="w-full text-left">Sign out</button>
              </form>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
