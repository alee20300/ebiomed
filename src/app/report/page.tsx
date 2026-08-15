import { Suspense } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/lib/actions/profiles"
import { getAppSetting } from "@/lib/actions/settings"
import { getOpenComplaintsForEquipment } from "@/lib/actions/visit-logs"
import { logEngineerVisit } from "@/lib/actions/visit-logs"
import { BarcodeScanner } from "@/components/report/barcode-scanner"
import { FaultForm } from "@/components/report/fault-form"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { AlertTriangle, ClipboardCheck, Clock } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import type { Equipment } from "@/lib/types"

interface PageProps {
  searchParams: Promise<{ tag?: string; error?: string; action?: string }>
}

async function EquipmentChoice({ tag }: { tag: string }) {
  const supabase = await createClient()
  const user = await getCurrentUser()
  const callLogEnabled = (await getAppSetting("call_log_workflow_enabled")) === true

  const { data: equipment } = await supabase
    .schema("ebiomed")
    .from("equipment")
    .select("*")
    .eq("tag_number", tag)
    .single()

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

  const eq = equipment as Equipment

  let openComplaints: { id: string; created_at: string; description: string }[] = []
  if (callLogEnabled && user && (user.role === "admin" || user.role === "technician")) {
    openComplaints = await getOpenComplaintsForEquipment(eq.id)
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="text-center">
            <p className="font-semibold text-lg">{eq.name}</p>
            <p className="text-sm text-muted-foreground">Tag: {eq.tag_number}</p>
            <p className="text-xs text-muted-foreground">{eq.department} — {eq.location}</p>
          </div>
        </CardContent>
      </Card>

      <Link href={`/report?tag=${tag}&action=fault`} className="block">
        <div className="flex items-center gap-4 rounded-lg border bg-white p-5 shadow-sm transition-all hover:border-danger hover:shadow-md">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-danger-subtle">
            <AlertTriangle className="h-6 w-6 text-danger-strong" />
          </div>
          <div>
            <p className="font-semibold text-base">Report a Fault</p>
            <p className="text-sm text-muted-foreground">Report an issue or malfunction with this equipment</p>
          </div>
        </div>
      </Link>

      <Link href={`/checklist?tag=${tag}`} className="block">
        <div className="flex items-center gap-4 rounded-lg border bg-white p-5 shadow-sm transition-all hover:border-primary hover:shadow-md">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <ClipboardCheck className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-base">Fill Checklist</p>
            <p className="text-sm text-muted-foreground">Complete an inspection checklist for this equipment</p>
          </div>
        </div>
      </Link>

      {openComplaints.length > 0 && (
        <div className="space-y-3 rounded-lg border border-info bg-info-subtle p-4">
          <p className="text-sm font-medium text-primary/80">Open Fault Reports</p>
          {openComplaints.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-md bg-white p-3 shadow-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{c.description}</p>
                <p className="text-xs text-muted-foreground">Reported {new Date(c.created_at).toLocaleDateString()}</p>
              </div>
              <form action={logEngineerVisit}>
                <input type="hidden" name="complaint_id" value={c.id} />
                <Button type="submit" size="sm" variant="outline" className="ml-3 shrink-0">
                  <Clock className="mr-1.5 h-4 w-4" />
                  Log Visit
                </Button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

async function EquipmentLookup({ tag }: { tag: string }) {
  const supabase = await createClient()
  const user = await getCurrentUser()
  const callLogEnabled = (await getAppSetting("call_log_workflow_enabled")) === true
  let biomedicalEngineers: Array<{ id: string; full_name: string }> = []

  if (callLogEnabled) {
    const { data } = await supabase
      .schema("ebiomed")
      .from("profiles")
      .select("id, full_name")
      .in("role", ["admin", "technician"])
      .ilike("department", "Biomedical Engineering")
      .order("full_name")

    biomedicalEngineers = data || []
  }

  const { data: equipment } = await supabase
    .schema("ebiomed")
    .from("equipment")
    .select("*")
    .eq("tag_number", tag)
    .single()

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

  return (
    <FaultForm
      equipment={equipment as Equipment}
      callLogEnabled={callLogEnabled}
      biomedicalEngineers={biomedicalEngineers}
      reporterDefaults={user ? {
        name: user.full_name ?? "",
        department: user.department ?? "",
        email: user.email ?? "",
      } : undefined}
    />
  )
}

export default async function ReportPage({ searchParams }: PageProps) {
  const params = await searchParams
  const tag = params.tag
  const action = params.action

  return (
    <div className="min-h-screen bg-muted">
      <div className="mx-auto max-w-lg px-4 py-8">
        <div className="mb-6 text-center">
          <Link href="/report" className="text-2xl font-bold text-primary">eBiomed</Link>
          <p className="mt-1 text-sm text-muted-foreground">Scan Equipment QR Code</p>
          <Link href="/request-status" className="mt-2 inline-block text-sm font-medium text-primary hover:text-primary/80">
            Track an existing request
          </Link>
        </div>

        {!tag ? (
          <BarcodeScanner />
        ) : action === "fault" ? (
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <EquipmentLookup tag={tag} />
          </Suspense>
        ) : (
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <EquipmentChoice tag={tag} />
          </Suspense>
        )}
      </div>
    </div>
  )
}
