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
import { AlertCircle, AlertTriangle, ClipboardCheck, Clock } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

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
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="font-medium text-red-800">Equipment not found</p>
        <p className="mt-1 text-sm text-red-600">No equipment with tag &quot;{tag}&quot; exists.</p>
        <Link href="/report" className="mt-4 inline-block text-sm text-primary hover:underline">
          Scan another
        </Link>
      </div>
    )
  }

  const eq = equipment as any

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
            <p className="text-sm text-gray-500">Tag: {eq.tag_number}</p>
            <p className="text-xs text-gray-400">{eq.department} — {eq.location}</p>
          </div>
        </CardContent>
      </Card>

      <Link href={`/report?tag=${tag}&action=fault`} className="block">
        <div className="flex items-center gap-4 rounded-lg border bg-white p-5 shadow-sm transition-all hover:border-red-300 hover:shadow-md">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-50">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <p className="font-semibold text-base">Report a Fault</p>
            <p className="text-sm text-gray-500">Report an issue or malfunction with this equipment</p>
          </div>
        </div>
      </Link>

      <Link href={`/checklist?tag=${tag}`} className="block">
        <div className="flex items-center gap-4 rounded-lg border bg-white p-5 shadow-sm transition-all hover:border-teal-300 hover:shadow-md">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-teal-50">
            <ClipboardCheck className="h-6 w-6 text-teal-600" />
          </div>
          <div>
            <p className="font-semibold text-base">Fill Checklist</p>
            <p className="text-sm text-gray-500">Complete an inspection checklist for this equipment</p>
          </div>
        </div>
      </Link>

      {openComplaints.length > 0 && (
        <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm font-medium text-blue-800">Open Fault Reports</p>
          {openComplaints.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-md bg-white p-3 shadow-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{c.description}</p>
                <p className="text-xs text-gray-500">Reported {new Date(c.created_at).toLocaleDateString()}</p>
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
  const callLogEnabled = (await getAppSetting("call_log_workflow_enabled")) === true

  const { data: equipment } = await supabase
    .schema("ebiomed")
    .from("equipment")
    .select("*")
    .eq("tag_number", tag)
    .single()

  if (!equipment) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="font-medium text-red-800">Equipment not found</p>
        <p className="mt-1 text-sm text-red-600">No equipment with tag &quot;{tag}&quot; exists.</p>
        <Link href="/report" className="mt-4 inline-block text-sm text-primary hover:underline">
          Scan another
        </Link>
      </div>
    )
  }

  return <FaultForm equipment={equipment as any} callLogEnabled={callLogEnabled} />
}

export default async function ReportPage({ searchParams }: PageProps) {
  const params = await searchParams
  const tag = params.tag
  const action = params.action

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-lg px-4 py-8">
        <div className="mb-6 text-center">
          <Link href="/report" className="text-2xl font-bold text-primary">eBiomed</Link>
          <p className="mt-1 text-sm text-gray-500">Scan Equipment QR Code</p>
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
