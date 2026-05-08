import Link from "next/link"
import { notFound } from "next/navigation"
import { getWorkOrderById } from "@/lib/actions/work-orders"
import { WorkOrderDetailCard } from "@/components/work-orders/wo-detail-card"
import { Button } from "@/components/ui/button"
import { ChevronLeft } from "lucide-react"

export default async function WorkOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const wo = await getWorkOrderById(id)

  if (!wo) notFound()

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/work-orders">
            <ChevronLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h2 className="text-2xl font-bold tracking-tight">Work Order Detail</h2>
      </div>
      <div className="rounded-lg border bg-white p-6">
        <WorkOrderDetailCard workOrder={wo} />
      </div>
    </div>
  )
}
