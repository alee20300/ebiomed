import Link from "next/link"
import { CheckCircle2 } from "lucide-react"

export default async function ReportSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; complaint?: string }>
}) {
  const { ref, complaint } = await searchParams
  const reference = ref || complaint?.slice(0, 8)

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4">
      <div className="max-w-md space-y-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-subtle">
          <CheckCircle2 className="h-8 w-8 text-success-strong" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Complaint Submitted</h1>
          <p className="text-muted-foreground">
            Your fault report has been submitted for review. The biomedical team will review it and create a work order if needed.
          </p>
          {reference && (
            <div className="rounded-lg border bg-white p-4">
              <p className="text-xs font-medium uppercase text-muted-foreground">Tracking Reference</p>
              <p className="mt-1 font-mono text-lg font-semibold text-foreground">{reference}</p>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          {ref && (
            <Link
              href={`/request-status/${encodeURIComponent(ref)}`}
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Track Status
            </Link>
          )}
          <Link
            href="/report"
            className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium text-primary hover:text-primary/80"
          >
            Report Another Issue
          </Link>
        </div>
      </div>
    </div>
  )
}
