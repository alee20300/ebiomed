import { Sidebar } from "@/components/layout/sidebar"
import { BottomNav } from "@/components/layout/bottom-nav"
import { AppHeader } from "@/components/layout/app-header"
import { getCurrentUser } from "@/lib/actions/profiles"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  const role = (user?.role as string) || "viewer"

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar role={role} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <AppHeader />
        <main className="min-h-0 min-w-0 flex-1 overflow-auto bg-background p-4 pb-20 sm:p-6 lg:p-8 lg:pb-8">
          {children}
        </main>
      </div>
      <BottomNav role={role} />
    </div>
  )
}
