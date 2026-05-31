import { Suspense } from "react"
import { getJobCards } from "@/lib/actions/job-cards"
import { createJobCard } from "@/lib/actions/job-cards"
import { getAppSetting } from "@/lib/actions/settings"
import { JobCardDetail } from "@/components/work-orders/job-card-detail"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

async function JobCardList({ workOrderId }: { workOrderId: string }) {
  const jobCards = await getJobCards(workOrderId)
  const expenseEnabled = await getAppSetting("expense_tracking_enabled") === true

  if (jobCards.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-gray-500">
        No job cards yet. Start one to track work on this order.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {jobCards.map((jc) => (
        <JobCardDetail key={jc.id} jobCard={jc} expenseEnabled={expenseEnabled} />
      ))}
    </div>
  )
}

export function JobCardSection({
  workOrderId,
  woStatus,
}: {
  workOrderId: string
  woStatus: string
}) {
  const canStart = woStatus === "open" || woStatus === "in_progress"

  return (
    <div className="rounded-lg border bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Job Cards</h3>
        {canStart && (
          <form action={async () => {
            "use server"
            await createJobCard(workOrderId)
          }}>
            <Button type="submit">Start Job Card</Button>
          </form>
        )}
      </div>
      <Suspense fallback={<Skeleton className="h-48 w-full" />}>
        <JobCardList workOrderId={workOrderId} />
      </Suspense>
    </div>
  )
}
