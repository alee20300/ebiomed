import { Sidebar } from "@/components/layout/sidebar"
import { BottomNav } from "@/components/layout/bottom-nav"
import { AppHeader } from "@/components/layout/app-header"
import { getCurrentUser } from "@/lib/actions/profiles"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  const role = (user?.role as string) || "viewer"

  return (
    <div className="flex min-h-screen">
      <Sidebar role={role} />
      <div className="flex flex-1 flex-col">
        <AppHeader />
        <main className="flex-1 overflow-auto bg-background p-8 pb-20 lg:p-8 lg:pb-8">
          {children}
        </main>
      </div>
      <BottomNav role={role} />
    </div>
  )
}
