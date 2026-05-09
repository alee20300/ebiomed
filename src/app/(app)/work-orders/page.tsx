import Link from "next/link"
import { Suspense } from "react"
import { getWorkOrders } from "@/lib/actions/work-orders"
import { getCurrentUser } from "@/lib/actions/profiles"
import { getViewerDepartments } from "@/lib/actions/departments"
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

export default async function WorkOrdersPage() {
  const user = await getCurrentUser()
  const isViewer = user?.role === "viewer"

  let subtitle: string | null = null
  if (isViewer) {
    const departments = await getViewerDepartments(user!.id)
    if (departments.length > 0) {
      subtitle = departments.map((d) => d.name).join(", ")
    } else {
      subtitle = "No departments assigned. Contact an administrator."
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {isViewer ? "My Departments — Work Orders" : "Work Orders"}
          </h2>
          {subtitle && (
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {!isViewer && (
          <Link href="/work-orders/new" className={cn(buttonVariants({}))}>
            <Plus className="mr-2 h-4 w-4" />
            New Work Order
          </Link>
        )}
      </div>
      <Suspense fallback={<Loading />}>
        <WOList />
      </Suspense>
    </div>
  )
}
