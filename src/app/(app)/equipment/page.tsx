import Link from "next/link"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { getEquipment } from "@/lib/actions/equipment"
import { getCurrentUser } from "@/lib/actions/profiles"
import { EquipmentTable } from "@/components/equipment/equipment-table"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus } from "lucide-react"

function EquipmentListLoading() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  )
}

async function EquipmentList() {
  const equipment = await getEquipment()
  return <EquipmentTable data={equipment} />
}

export default async function EquipmentPage() {
  const user = await getCurrentUser()
  const isViewer = user?.role === "viewer"

  if (isViewer) redirect("/dashboard")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Equipment</h2>
        {!isViewer && (
          <Link href="/equipment/new" className={cn(buttonVariants({}))}>
            <Plus className="mr-2 h-4 w-4" />
            Add Equipment
          </Link>
        )}
      </div>
      <Suspense fallback={<EquipmentListLoading />}>
        <EquipmentList />
      </Suspense>
    </div>
  )
}
