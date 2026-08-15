import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { WorkOrderForm } from "@/components/work-orders/wo-form"

export default async function NewWorkOrderPage({
  searchParams,
}: {
  searchParams?: Promise<{ equipment_id?: string }>
}) {
  const params = await searchParams

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/work-orders" className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}>
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h2 className="text-2xl font-bold tracking-tight">New Work Order</h2>
      </div>
      <div className="rounded-lg border bg-white p-6">
        <WorkOrderForm preselectedEquipmentId={params?.equipment_id} />
      </div>
    </div>
  )
}
