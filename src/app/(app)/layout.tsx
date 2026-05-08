import { Sidebar } from "@/components/layout/sidebar"
import { BottomNav } from "@/components/layout/bottom-nav"
import { AppHeader } from "@/components/layout/app-header"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <AppHeader />
        <main className="flex-1 overflow-auto bg-gray-50 p-4 pb-20 lg:p-6 lg:pb-6">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  )
}
