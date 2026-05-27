import { Suspense } from "react"
import { getReferenceStandards } from "@/lib/actions/calibration"
import { ReferenceStandardsTable } from "@/components/calibration/reference-standards-table"
import { Skeleton } from "@/components/ui/skeleton"

async function ReferenceStandardsContent() {
  const standards = await getReferenceStandards()
  return <ReferenceStandardsTable standards={standards} />
}

export default function ReferenceStandardsPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">Reference Standards</h2>
      <p className="text-sm text-muted-foreground">
        Certifiied master instruments used for equipment calibration. Required by ISO 15189/17025.
      </p>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <ReferenceStandardsContent />
      </Suspense>
    </div>
  )
}
