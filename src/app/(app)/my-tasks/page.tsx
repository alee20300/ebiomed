import { redirect } from "next/navigation"
import { Suspense } from "react"
import { getCurrentUser } from "@/lib/actions/profiles"
import { getAssignedWorkOrders } from "@/lib/actions/work-orders"
import { MyTasksTable } from "@/components/work-orders/my-tasks-table"
import { Skeleton } from "@/components/ui/skeleton"

type TaskFilter = "active" | "open" | "in_progress" | "preventive" | "corrective" | "done"

function normalizeFilter(value?: string): TaskFilter {
  return ["active", "open", "in_progress", "preventive", "corrective", "done"].includes(value || "") ? (value as TaskFilter) : "active"
}

async function MyTasksList({ filter }: { filter: TaskFilter }) {
  const user = await getCurrentUser()
  if (!user) return null

  const orders = await getAssignedWorkOrders(user.id)

  if (orders.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-8 text-center text-muted-foreground">
        No work orders assigned to you.
      </div>
    )
  }

  return <MyTasksTable orders={orders} initialFilter={filter} />
}

export default async function MyTasksPage({
  searchParams,
}: {
  searchParams?: Promise<{ filter?: string }>
}) {
  const user = await getCurrentUser()
  if (user?.role === "viewer") redirect("/dashboard")
  const params = await searchParams
  const filter = normalizeFilter(params?.filter)

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">My Tasks</h2>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <MyTasksList filter={filter} />
      </Suspense>
    </div>
  )
}
