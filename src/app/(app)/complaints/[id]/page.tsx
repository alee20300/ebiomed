import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { getComplaintById, getDuplicateRequestCandidates } from "@/lib/actions/complaints"
import { getComplaintVisits } from "@/lib/actions/visit-logs"
import { getAppSetting } from "@/lib/actions/settings"
import { getCurrentUser } from "@/lib/actions/profiles"
import { getViewerDepartments } from "@/lib/actions/departments"
import { ComplaintDetailCard } from "@/components/complaints/complaint-detail-card"
import { CaseTimeline } from "@/components/shared/case-timeline"
import { getCaseTimelineForComplaint } from "@/lib/actions/case-timeline"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ChevronLeft } from "lucide-react"

export default async function ComplaintDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return redirect("/login")

  const complaint = await getComplaintById(id)

  if (!complaint) notFound()

  if (user.role === "viewer") {
    const viewerDepartments = await getViewerDepartments(user.id)
    const allowedDepartments = new Set(viewerDepartments.map((department) => department.name))
    if (user.department) allowedDepartments.add(user.department)
    const requestDepartment = complaint.reported_by_department || complaint.equipment?.department
    if (!requestDepartment || !allowedDepartments.has(requestDepartment)) {
      return redirect("/requests")
    }
  }

  const [callLogSetting, timeline] = await Promise.all([
    getAppSetting("call_log_workflow_enabled"),
    getCaseTimelineForComplaint(id),
  ])
  const callLogEnabled = callLogSetting === true
  const visits = callLogEnabled ? await getComplaintVisits(id) : []
  const canReview = user.role === "admin" || user.role === "technician"
  const duplicateCandidates = canReview ? await getDuplicateRequestCandidates(id) : []

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/complaints" className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}>
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h2 className="text-2xl font-bold tracking-tight">Complaint Detail</h2>
      </div>
      <div className="rounded-lg border bg-white p-6">
        <ComplaintDetailCard
          complaint={complaint}
          visits={visits}
          duplicateCandidates={duplicateCandidates}
          callLogEnabled={callLogEnabled}
          canReview={canReview}
        />
      </div>
      <CaseTimeline events={timeline} />
    </div>
  )
}
