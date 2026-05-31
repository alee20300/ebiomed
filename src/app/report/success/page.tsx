import Link from "next/link"

export default async function ReportSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ complaint?: string }>
}) {
  const { complaint } = await searchParams

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md space-y-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-gray-900">Complaint Submitted</h1>
          <p className="text-gray-600">
            Your fault report has been submitted for review. The biomedical team will review it and create a work order if needed.
          </p>
          {complaint && (
            <p className="text-sm text-gray-500">
              Reference: {complaint.slice(0, 8)}
            </p>
          )}
        </div>
        <Link
          href="/report"
          className="inline-block text-sm font-medium text-blue-600 hover:text-blue-800"
        >
          Report Another Issue
        </Link>
      </div>
    </div>
  )
}
