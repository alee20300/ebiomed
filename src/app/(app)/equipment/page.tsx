import Link from "next/link"
import { Suspense } from "react"
import { getEquipment } from "@/lib/actions/equipment"
import { EquipmentTable } from "@/components/equipment/equipment-table"
import { Button } from "@/components/ui/button"
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

export default function EquipmentPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Equipment</h2>
        <Button asChild>
          <Link href="/equipment/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Equipment
          </Link>
        </Button>
      </div>
      <Suspense fallback={<EquipmentListLoading />}>
        <EquipmentList />
      </Suspense>
    </div>
  )
}
