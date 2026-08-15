import Link from "next/link"
import { Suspense } from "react"
import { notFound } from "next/navigation"
import { getEquipmentById, getEquipmentServiceSummary } from "@/lib/actions/equipment"
import { getAssetGovernanceData } from "@/lib/actions/asset-governance"
import { EquipmentInfoTab } from "@/components/equipment/equipment-info-tab"
import { EquipmentHistoryTab } from "@/components/equipment/equipment-history-tab"
import { EquipmentPMTab } from "@/components/equipment/equipment-pm-tab"
import { EquipmentDocumentsTab } from "@/components/equipment/equipment-documents-tab"
import { EquipmentGovernanceTab } from "@/components/equipment/equipment-governance-tab"
import { EquipmentPartsTab } from "@/components/equipment/equipment-parts-tab"
import { EquipmentCalibrationTab } from "@/components/calibration/equipment-calibration-tab"
import { CalibrationExecution } from "@/components/calibration/calibration-execution"
import { EquipmentCertificatesTab } from "@/components/calibration/equipment-certificates-tab"
import { EquipmentParentChild } from "@/components/equipment/equipment-parent-child"
import { ChecklistHistory } from "@/components/checklist/checklist-history"
import { QRCodeDisplay } from "@/components/report/qrcode-display"
import { PrintLabelButton } from "@/components/report/print-label-button"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusBadge } from "@/components/shared/status-badge"
import { MobileDisclosureSection } from "@/components/shared/mobile-disclosure-section"
import { ChevronLeft, ClipboardCheck, Download, Gauge, FileText, Package } from "lucide-react"

export default async function EquipmentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { id } = await params
  const { tab } = await searchParams
  const selectedTab = ["info", "history", "pm", "parts", "calibration", "documents", "governance", "certificates", "checklist"].includes(tab || "") ? tab : "info"
  const [equipment, serviceSummary, governance] = await Promise.all([
    getEquipmentById(id),
    getEquipmentServiceSummary(id),
    getAssetGovernanceData(id),
  ])

  if (!equipment) notFound()

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <Link href="/equipment" className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}>
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold tracking-tight">{equipment.name}</h2>
              <StatusBadge status={equipment.status} />
            </div>
            <p className="text-sm text-muted-foreground">Tag: {equipment.tag_number}</p>
          </div>
        </div>
        <div className="hidden flex-wrap gap-2 md:flex">
          {(["zip", "pdf", "csv"] as const).map((format) => (
            <Link
              key={format}
              href={`/api/compliance/assets/${id}/packet?format=${format}`}
              className={cn(buttonVariants({ variant: format === "zip" ? "default" : "outline", size: "sm" }))}
            >
              <Download className="mr-2 h-4 w-4" />
              {format.toUpperCase()}
            </Link>
          ))}
        </div>
      </div>

      <div className="md:hidden">
        <MobileDisclosureSection title="Compliance exports" summary="Download ZIP, PDF, or CSV packet">
          <div className="grid grid-cols-3 gap-2">
            {(["zip", "pdf", "csv"] as const).map((format) => (
              <Link
                key={format}
                href={`/api/compliance/assets/${id}/packet?format=${format}`}
                className={cn(buttonVariants({ variant: format === "zip" ? "default" : "outline", size: "sm" }))}
              >
                <Download className="mr-2 h-4 w-4" />
                {format.toUpperCase()}
              </Link>
            ))}
          </div>
        </MobileDisclosureSection>
      </div>

      <Tabs defaultValue={selectedTab} className="w-full min-w-0">
        <div className="overflow-x-auto pb-1">
        <TabsList className="min-w-max">
          <TabsTrigger value="info">Information</TabsTrigger>
          <TabsTrigger value="history">Work History</TabsTrigger>
          <TabsTrigger value="pm">PM Schedules</TabsTrigger>
          <TabsTrigger value="parts">
            <Package className="mr-1 h-4 w-4" />
            Related Parts
          </TabsTrigger>
          <TabsTrigger value="calibration">
            <Gauge className="mr-1 h-4 w-4" />
            Calibration
          </TabsTrigger>
          <TabsTrigger value="documents">
            <FileText className="mr-1 h-4 w-4" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="governance">
            <FileText className="mr-1 h-4 w-4" />
            Governance
          </TabsTrigger>
          <TabsTrigger value="certificates">
            <FileText className="mr-1 h-4 w-4" />
            Certificates
          </TabsTrigger>
          <TabsTrigger value="checklist">
            <ClipboardCheck className="mr-1 h-4 w-4" />
            Checklist
          </TabsTrigger>
        </TabsList>
        </div>
        <TabsContent value="info" className="rounded-lg border bg-white p-4 sm:p-6">
          <EquipmentInfoTab
            equipment={equipment}
            serviceSummary={serviceSummary}
            labelTools={(
              <div>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6 print-only">
                  <QRCodeDisplay value={`${siteUrl}/report?tag=${equipment.tag_number}`} />
                  <div className="space-y-1 text-sm">
                    <p className="text-base font-semibold">{equipment.name}</p>
                    <p className="text-muted-foreground">Tag: {equipment.tag_number}</p>
                    <p className="text-muted-foreground">{equipment.department} - {equipment.location}</p>
                  </div>
                </div>
                <PrintLabelButton />
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  Scan QR code to report a fault or fill a checklist
                </p>
              </div>
            )}
            hierarchy={(
              <Suspense fallback={<Skeleton className="h-32 w-full" />}>
                <EquipmentParentChild equipment={equipment} />
              </Suspense>
            )}
          />
        </TabsContent>
        <TabsContent value="history" className="rounded-lg border bg-white p-4 sm:p-6">
          <Suspense fallback={<Skeleton className="h-32 w-full" />}>
            <EquipmentHistoryTab equipmentId={id} />
          </Suspense>
        </TabsContent>
        <TabsContent value="pm" className="rounded-lg border bg-white p-4 sm:p-6">
          <Suspense fallback={<Skeleton className="h-32 w-full" />}>
            <EquipmentPMTab equipmentId={id} />
          </Suspense>
        </TabsContent>
        <TabsContent value="parts" className="rounded-lg border bg-white p-4 sm:p-6">
          <Suspense fallback={<Skeleton className="h-40 w-full" />}>
            <EquipmentPartsTab equipmentId={id} />
          </Suspense>
        </TabsContent>
        <TabsContent value="calibration" className="space-y-6">
          <div className="rounded-lg border bg-white p-4 sm:p-6">
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
        <TabsContent value="checklist" className="rounded-lg border bg-white p-4 sm:p-6">
          <Suspense fallback={<Skeleton className="h-32 w-full" />}>
            <ChecklistHistory equipmentId={id} />
          </Suspense>
        </TabsContent>
        <TabsContent value="certificates" className="rounded-lg border bg-white p-4 sm:p-6">
          <Suspense fallback={<Skeleton className="h-32 w-full" />}>
            <EquipmentCertificatesTab equipmentId={id} />
          </Suspense>
        </TabsContent>
        <TabsContent value="documents" className="rounded-lg border bg-white p-4 sm:p-6">
          <Suspense fallback={<Skeleton className="h-32 w-full" />}>
            <EquipmentDocumentsTab equipmentId={id} />
          </Suspense>
        </TabsContent>
        <TabsContent value="governance" className="rounded-lg border bg-white p-4 sm:p-6">
          <EquipmentGovernanceTab
            equipment={equipment}
            cybersecurity={governance.cybersecurity}
            commissioning={governance.commissioning}
            decommissioning={governance.decommissioning}
          />
        </TabsContent>
      </Tabs>

    </div>
  )
}
