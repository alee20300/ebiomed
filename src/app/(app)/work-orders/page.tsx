import Link from "next/link"
import { Suspense } from "react"
import { getWorkOrders } from "@/lib/actions/work-orders"
import { WorkOrderTable } from "@/components/work-orders/wo-table"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus } from "lucide-react"

function Loading() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  )
}

async function WOList() {
  const orders = await getWorkOrders()
  return <WorkOrderTable data={orders} />
}

export default function WorkOrdersPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Work Orders</h2>
        <Link href="/work-orders/new" className={cn(buttonVariants({}))}>
          <Plus className="mr-2 h-4 w-4" />
          New Work Order
        </Link>
      </div>
      <Suspense fallback={<Loading />}>
        <WOList />
      </Suspense>
    </div>
  )
}
