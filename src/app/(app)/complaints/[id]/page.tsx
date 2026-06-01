import Link from "next/link"
import { notFound } from "next/navigation"
import { getComplaintById } from "@/lib/actions/complaints"
import { getComplaintVisits } from "@/lib/actions/visit-logs"
import { getAppSetting } from "@/lib/actions/settings"
import { ComplaintDetailCard } from "@/components/complaints/complaint-detail-card"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ChevronLeft } from "lucide-react"

export default async function ComplaintDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const complaint = await getComplaintById(id)

  if (!complaint) notFound()

  const callLogEnabled = (await getAppSetting("call_log_workflow_enabled")) === true
  const visits = callLogEnabled ? await getComplaintVisits(id) : []

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/complaints" className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}>
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h2 className="text-2xl font-bold tracking-tight">Complaint Detail</h2>
      </div>
      <div className="rounded-lg border bg-white p-6">
        <ComplaintDetailCard complaint={complaint} visits={visits} callLogEnabled={callLogEnabled} />
      </div>
    </div>
  )
}
