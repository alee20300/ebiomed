import { redirect } from "next/navigation"
import { Suspense } from "react"
import { getPMSchedules } from "@/lib/actions/pm-schedules"
import { getCurrentUser } from "@/lib/actions/profiles"
import { PMTable } from "@/components/pm-schedules/pm-table"
import { PMDashboard } from "@/components/pm-schedules/pm-dashboard"
import { PMActions } from "@/components/pm-schedules/pm-actions"
import { Skeleton } from "@/components/ui/skeleton"

function Loading() {
  return <div className="space-y-3">
    {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
  </div>
}

async function PMList() {
  const schedules = await getPMSchedules()
  return <PMTable data={schedules} />
}

export default async function PMSchedulesPage() {
  const user = await getCurrentUser()
  const isViewer = user?.role === "viewer"

  if (isViewer) redirect("/dashboard")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">PM Schedules</h2>
        <PMActions isViewer={isViewer} />
      </div>
      <Suspense fallback={<Skeleton className="h-48 w-full" />}>
        <PMDashboard />
      </Suspense>
      <Suspense fallback={<Loading />}>
        <PMList />
      </Suspense>
    </div>
  )
}
