import Link from "next/link"
import { Suspense } from "react"
import { notFound } from "next/navigation"
import { getEquipmentById } from "@/lib/actions/equipment"
import { EquipmentInfoTab } from "@/components/equipment/equipment-info-tab"
import { EquipmentHistoryTab } from "@/components/equipment/equipment-history-tab"
import { EquipmentPMTab } from "@/components/equipment/equipment-pm-tab"
import { BarcodeDisplay } from "@/components/report/barcode-display"
import { QRCodeDisplay } from "@/components/report/qrcode-display"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusBadge } from "@/components/shared/status-badge"
import { ChevronLeft, Printer } from "lucide-react"

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

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Barcode</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center">
          <BarcodeDisplay value={equipment.tag_number} />
          <p className="mt-2 text-xs text-gray-500">Scan to report a fault or print for equipment label</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">QR Label</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6 print-only">
            <QRCodeDisplay
              value={`${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/report?tag=${equipment.tag_number}`}
            />
            <div className="text-sm space-y-1">
              <p className="font-semibold text-base">{equipment.name}</p>
              <p className="text-muted-foreground">Tag: {equipment.tag_number}</p>
              <p className="text-muted-foreground">{equipment.department} — {equipment.location}</p>
            </div>
          </div>
          <Button
            onClick={() => window.print()}
            className="mt-4 w-full"
            variant="outline"
          >
            <Printer className="mr-2 h-4 w-4" />
            Print Label
          </Button>
          <p className="mt-2 text-xs text-muted-foreground text-center">
            Scan QR code with phone camera to report a fault
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
