import { Suspense } from "react"
import { getPMSchedules } from "@/lib/actions/pm-schedules"
import { PMTable } from "@/components/pm-schedules/pm-table"
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

export default function PMSchedulesPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">PM Schedules</h2>
      <Suspense fallback={<Loading />}>
        <PMList />
      </Suspense>
    </div>
  )
}
