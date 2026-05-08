import { signout, getCurrentUser } from "@/lib/actions/profiles"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Menu } from "lucide-react"
import Link from "next/link"

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
          <DropdownMenuItem disabled className="text-xs text-gray-500">
            {user?.email}
          </DropdownMenuItem>
          <DropdownMenuItem>
            <form action={signout} className="w-full">
              <button type="submit" className="w-full text-left">Sign out</button>
            </form>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
