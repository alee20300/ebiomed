import { redirect } from "next/navigation"
import { Suspense } from "react"
import Link from "next/link"
import { getCurrentUser } from "@/lib/actions/profiles"
import { getAssignedWorkOrders } from "@/lib/actions/work-orders"
import { StatusBadge } from "@/components/shared/status-badge"
import { PriorityBadge } from "@/components/shared/priority-badge"
import { formatRelative } from "@/lib/utils/format"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"

async function MyTasksList() {
  const user = await getCurrentUser()
  if (!user) return null

  const orders = await getAssignedWorkOrders(user.id)

  if (orders.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-8 text-center text-gray-500">
        No work orders assigned to you.
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Equipment</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((wo) => (
            <TableRow key={wo.id}>
              <TableCell>
                <Link
                  href={`/work-orders/${wo.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {wo.equipment?.name || "—"}
                </Link>
              </TableCell>
              <TableCell className="capitalize">{wo.type}</TableCell>
              <TableCell>
                <PriorityBadge priority={wo.priority} />
              </TableCell>
              <TableCell>
                <StatusBadge status={wo.status} />
              </TableCell>
              <TableCell className="max-w-xs truncate">
                {wo.description}
              </TableCell>
              <TableCell className="text-sm text-gray-500">
                {formatRelative(wo.created_at)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export default async function MyTasksPage() {
  const user = await getCurrentUser()
  if (user?.role === "viewer") redirect("/dashboard")

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">My Tasks</h2>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <MyTasksList />
      </Suspense>
    </div>
  )
}
