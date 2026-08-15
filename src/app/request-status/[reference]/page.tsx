import Link from "next/link"
import { notFound } from "next/navigation"
import { getPublicRequestByReference } from "@/lib/actions/complaints"
import { RequestStatusCard } from "@/components/requests/request-status-card"

export default async function RequestStatusPage({
  params,
}: {
  params: Promise<{ reference: string }>
}) {
  const { reference } = await params
  const complaint = await getPublicRequestByReference(decodeURIComponent(reference))

  if (!complaint) notFound()

  return (
    <div className="min-h-screen bg-muted">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <div className="flex items-center justify-between">
          <Link href="/report" className="text-2xl font-bold text-primary">eBiomed</Link>
          <Link href="/request-status" className="text-sm font-medium text-primary hover:text-primary/80">
            Track another
          </Link>
        </div>
        <RequestStatusCard complaint={complaint} publicView />
      </div>
    </div>
  )
}
