import Link from "next/link"
import { notFound } from "next/navigation"
import { getWorkOrderById, getWorkOrderCloseoutStatus } from "@/lib/actions/work-orders"
import { WorkOrderDetailCard } from "@/components/work-orders/wo-detail-card"
import { CommentTimeline } from "@/components/work-orders/comment-timeline"
import { JobCardSection } from "@/components/work-orders/job-card-section"
import { OfflineSyncBanner } from "@/components/work-orders/offline-sync-banner"
import { WorkOrderPhotoSection } from "@/components/work-orders/work-order-photo-section"
import { CaseTimeline } from "@/components/shared/case-timeline"
import { getCaseTimelineForWorkOrder } from "@/lib/actions/case-timeline"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ChevronLeft, Printer } from "lucide-react"

export default async function WorkOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [wo, closeoutStatus, timeline] = await Promise.all([
    getWorkOrderById(id),
    getWorkOrderCloseoutStatus(id),
    getCaseTimelineForWorkOrder(id),
  ])

  if (!wo) notFound()

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/work-orders" className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}>
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h2 className="text-2xl font-bold tracking-tight">Work Order Detail</h2>
        </div>
        {wo.status === "completed" && (
          <Link
            href={`/work-orders/${wo.id}/report`}
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            <Printer className="mr-2 h-4 w-4" />
            Print Report
          </Link>
        )}
      </div>

      <OfflineSyncBanner workOrderId={id} />

      <div className="rounded-lg border bg-white p-6">
        <WorkOrderDetailCard workOrder={wo} closeoutStatus={closeoutStatus} />
      </div>

      <CaseTimeline events={timeline} />

      <JobCardSection workOrderId={id} woStatus={wo.status} />

      <WorkOrderPhotoSection workOrderId={id} woStatus={wo.status} />

      <div className="rounded-lg border bg-white p-6">
        <CommentTimeline workOrderId={id} />
      </div>
    </div>
  )
}
