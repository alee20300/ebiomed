import Link from "next/link"
import { Suspense } from "react"
import { notFound } from "next/navigation"
import { getEquipmentById } from "@/lib/actions/equipment"
import { EquipmentInfoTab } from "@/components/equipment/equipment-info-tab"
import { EquipmentHistoryTab } from "@/components/equipment/equipment-history-tab"
import { EquipmentPMTab } from "@/components/equipment/equipment-pm-tab"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusBadge } from "@/components/shared/status-badge"
import { ChevronLeft } from "lucide-react"

export default async function EquipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const equipment = await getEquipmentById(id)

  if (!equipment) notFound()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/equipment">
            <ChevronLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight">{equipment.name}</h2>
            <StatusBadge status={equipment.status} />
          </div>
          <p className="text-sm text-gray-500">Tag: {equipment.tag_number}</p>
        </div>
        <div className="ml-auto">
          <Button asChild variant="outline">
            <Link href={`/equipment/${id}?edit=1`}>Edit</Link>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="info" className="w-full">
        <TabsList>
          <TabsTrigger value="info">Information</TabsTrigger>
          <TabsTrigger value="history">Work History</TabsTrigger>
          <TabsTrigger value="pm">PM Schedules</TabsTrigger>
        </TabsList>
        <TabsContent value="info" className="rounded-lg border bg-white p-6">
          <EquipmentInfoTab equipment={equipment} />
        </TabsContent>
        <TabsContent value="history" className="rounded-lg border bg-white p-6">
          <Suspense fallback={<Skeleton className="h-32 w-full" />}>
            <EquipmentHistoryTab equipmentId={id} />
          </Suspense>
        </TabsContent>
        <TabsContent value="pm" className="rounded-lg border bg-white p-6">
          <Suspense fallback={<Skeleton className="h-32 w-full" />}>
            <EquipmentPMTab equipmentId={id} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  )
}
