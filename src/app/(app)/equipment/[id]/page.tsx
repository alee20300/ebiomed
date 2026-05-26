import Link from "next/link"
import { Suspense } from "react"
import { notFound } from "next/navigation"
import { getEquipmentById } from "@/lib/actions/equipment"
import { getChecklistTemplates } from "@/lib/actions/checklist"
import { EquipmentInfoTab } from "@/components/equipment/equipment-info-tab"
import { EquipmentHistoryTab } from "@/components/equipment/equipment-history-tab"
import { EquipmentPMTab } from "@/components/equipment/equipment-pm-tab"
import { ChecklistHistory } from "@/components/checklist/checklist-history"
import { ChecklistTemplateManager } from "@/components/checklist/checklist-template-manager"
import { EquipmentForm } from "@/components/equipment/equipment-form"
import { QRCodeDisplay } from "@/components/report/qrcode-display"
import { PrintLabelButton } from "@/components/report/print-label-button"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusBadge } from "@/components/shared/status-badge"
import { ChevronLeft, ClipboardCheck } from "lucide-react"

export default async function EquipmentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ edit?: string }>
}) {
  const { id } = await params
  const { edit } = await searchParams
  const equipment = await getEquipmentById(id)

  if (!equipment) notFound()

  const isEditing = edit === "1"
  const templates = isEditing ? await getChecklistTemplates(id) : []
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/equipment" className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}>
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight">
              {isEditing ? "Edit Equipment" : equipment.name}
            </h2>
            {!isEditing && <StatusBadge status={equipment.status} />}
          </div>
          <p className="text-sm text-gray-500">Tag: {equipment.tag_number}</p>
        </div>
        <div className="ml-auto">
          {isEditing ? (
            <Link href={`/equipment/${id}`} className={cn(buttonVariants({ variant: "outline" }))}>
              Cancel
            </Link>
          ) : (
            <Link href={`/equipment/${id}?edit=1`} className={cn(buttonVariants({ variant: "outline" }))}>
              Edit
            </Link>
          )}
        </div>
      </div>

      {isEditing ? (
        <div className="space-y-6">
          <div className="rounded-lg border bg-white p-6">
            <EquipmentForm equipment={equipment} />
          </div>
          <div className="rounded-lg border bg-white p-6">
            <ChecklistTemplateManager equipmentId={id} templates={templates} />
          </div>
        </div>
      ) : (
        <Tabs defaultValue="info" className="w-full">
          <TabsList>
            <TabsTrigger value="info">Information</TabsTrigger>
            <TabsTrigger value="history">Work History</TabsTrigger>
            <TabsTrigger value="pm">PM Schedules</TabsTrigger>
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
          <TabsContent value="checklist" className="rounded-lg border bg-white p-6">
            <Suspense fallback={<Skeleton className="h-32 w-full" />}>
              <ChecklistHistory equipmentId={id} />
            </Suspense>
          </TabsContent>
        </Tabs>
      )}

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
