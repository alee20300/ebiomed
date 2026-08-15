import { Suspense } from "react"
import Link from "next/link"
import { getEquipmentByTag, getChecklistTemplates } from "@/lib/actions/checklist"
import { ChecklistForm } from "@/components/checklist/checklist-form"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertCircle } from "lucide-react"

interface PageProps {
  searchParams: Promise<{ tag?: string; error?: string }>
}

async function ChecklistContent({ tag }: { tag: string }) {
  const equipment = await getEquipmentByTag(tag)

  if (!equipment) {
    return (
      <div className="rounded-lg border border-danger bg-danger-subtle p-6 text-center">
        <p className="font-medium text-danger-strong">Equipment not found</p>
        <p className="mt-1 text-sm text-danger-strong">No equipment with tag &quot;{tag}&quot; exists.</p>
        <Link href="/report" className="mt-4 inline-block text-sm text-primary hover:underline">
          Scan another
        </Link>
      </div>
    )
  }

  const templates = await getChecklistTemplates(equipment.id)

  if (templates.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-6 text-center">
        <p className="font-medium text-foreground">No Checklists Available</p>
        <p className="mt-1 text-sm text-muted-foreground">
          No checklists have been configured for {equipment.name}. Please contact the biomedical department.
        </p>
        <Link href={`/report?tag=${tag}`} className="mt-4 inline-block text-sm text-primary hover:underline">
          Report a fault instead
        </Link>
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-white p-6">
      <div className="mb-6 text-center">
        <p className="font-semibold text-lg">{equipment.name}</p>
        <p className="text-sm text-muted-foreground">Tag: {equipment.tag_number}</p>
        <p className="text-xs text-muted-foreground">{equipment.department} — {equipment.location}</p>
      </div>

      <div className="space-y-4">
        {templates.map((tpl) => (
          <details key={tpl.id} className="group rounded-lg border bg-muted">
            <summary className="flex cursor-pointer items-center gap-2 p-3 text-sm font-medium">
              <span className="text-primary">▸</span>
              <span>{tpl.name}</span>
              <span className="ml-auto text-xs text-muted-foreground capitalize">{tpl.frequency}</span>
            </summary>
            <div className="border-t p-4">
              <ChecklistForm
                equipmentId={equipment.id}
                templateId={tpl.id}
                templateName={tpl.name}
                items={tpl.items}
              />
            </div>
          </details>
        ))}
      </div>
    </div>
  )
}

export default async function ChecklistPage({ searchParams }: PageProps) {
  const params = await searchParams
  const tag = params.tag
  const error = params.error

  return (
    <div className="min-h-screen bg-muted">
      <div className="mx-auto max-w-lg px-4 py-8">
        <div className="mb-6 text-center">
          <Link href="/report" className="text-2xl font-bold text-primary">eBiomed</Link>
          <p className="mt-1 text-sm text-muted-foreground">Equipment Checklist</p>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-md border border-danger bg-danger-subtle p-3 text-sm text-danger-strong">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {!tag ? (
          <div className="rounded-lg border bg-white p-6 text-center">
            <p className="text-sm text-muted-foreground">Scan the QR code on the equipment label to access its checklist.</p>
            <Link href="/report" className="mt-4 inline-block text-sm text-primary hover:underline">
              Report a fault instead
            </Link>
          </div>
        ) : (
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <ChecklistContent tag={tag} />
          </Suspense>
        )}
      </div>
    </div>
  )
}
