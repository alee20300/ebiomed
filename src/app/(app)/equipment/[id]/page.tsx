import Link from "next/link"
import { Suspense } from "react"
import { notFound } from "next/navigation"
import { getEquipmentById } from "@/lib/actions/equipment"
import { EquipmentInfoTab } from "@/components/equipment/equipment-info-tab"
import { EquipmentHistoryTab } from "@/components/equipment/equipment-history-tab"
import { EquipmentPMTab } from "@/components/equipment/equipment-pm-tab"
import { EquipmentCalibrationTab } from "@/components/calibration/equipment-calibration-tab"
import { CalibrationExecution } from "@/components/calibration/calibration-execution"
import { ChecklistHistory } from "@/components/checklist/checklist-history"
import { QRCodeDisplay } from "@/components/report/qrcode-display"
import { PrintLabelButton } from "@/components/report/print-label-button"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusBadge } from "@/components/shared/status-badge"
import { ChevronLeft, ClipboardCheck, Gauge } from "lucide-react"

export default async function EquipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const equipment = await getEquipmentById(id)

  if (!equipment) notFound()

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/equipment" className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}>
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight">{equipment.name}</h2>
            <StatusBadge status={equipment.status} />
          </div>
          <p className="text-sm text-gray-500">Tag: {equipment.tag_number}</p>
        </div>
      </div>

      <Tabs defaultValue="info" className="w-full">
        <TabsList>
          <TabsTrigger value="info">Information</TabsTrigger>
          <TabsTrigger value="history">Work History</TabsTrigger>
          <TabsTrigger value="pm">PM Schedules</TabsTrigger>
          <TabsTrigger value="calibration">
            <Gauge className="mr-1 h-4 w-4" />
            Calibration
          </TabsTrigger>
          <TabsTrigger value="checklist">
            <ClipboardCheck className="mr-1 h-4 w-4" />
            Checklist
          </TabsTrigger>
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
        <TabsContent value="calibration" className="space-y-6">
          <div className="rounded-lg border bg-white p-6">
            <EquipmentCalibrationTab
              equipmentId={id}
              calibrationIntervalDays={equipment.calibration_interval_days}
              calibrationParams={equipment.calibration_parameters}
            />
          </div>
          <CalibrationExecution
            equipmentId={id}
            equipmentName={equipment.name}
            equipmentTag={equipment.tag_number}
            calibrationParams={equipment.calibration_parameters}
          />
        </TabsContent>
        <TabsContent value="checklist" className="rounded-lg border bg-white p-6">
          <Suspense fallback={<Skeleton className="h-32 w-full" />}>
            <ChecklistHistory equipmentId={id} />
          </Suspense>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Equipment QR Code</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6 print-only">
            <QRCodeDisplay value={`${siteUrl}/report?tag=${equipment.tag_number}`} />
            <div className="text-sm space-y-1">
              <p className="font-semibold text-base">{equipment.name}</p>
              <p className="text-muted-foreground">Tag: {equipment.tag_number}</p>
              <p className="text-muted-foreground">{equipment.department} — {equipment.location}</p>
            </div>
          </div>
          <PrintLabelButton />
          <p className="mt-2 text-xs text-muted-foreground text-center">
            Scan QR code to report a fault or fill a checklist
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
