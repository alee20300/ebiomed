import { Suspense } from "react"
import { getComplaints } from "@/lib/actions/complaints"
import { ComplaintTable } from "@/components/complaints/complaint-table"
import { Skeleton } from "@/components/ui/skeleton"

async function ComplaintList() {
  const complaints = await getComplaints()
  return <ComplaintTable complaints={complaints} />
}

export default function ComplaintsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Complaints</h2>
        <p className="text-sm text-gray-500">Review and approve pending fault reports</p>
      </div>
      <div className="rounded-lg border bg-white p-6">
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          <ComplaintList />
        </Suspense>
      </div>
    </div>
  )
}
