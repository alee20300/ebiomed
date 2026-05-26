import { getChecklistSubmissions } from "@/lib/actions/checklist"
import { formatDateTime } from "@/lib/utils/format"
import { Badge } from "@/components/ui/badge"

interface Props {
  equipmentId: string
}

export async function ChecklistHistory({ equipmentId }: Props) {
  const submissions = await getChecklistSubmissions(equipmentId)

  if (submissions.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-gray-500">
        No checklist submissions yet. End users can submit checklists by scanning the QR code on the equipment label.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {submissions.map((submission) => {
        const failedCount = submission.items.filter((i) => i.status === "not_ok").length
        const templateName = (submission as any).template?.name || "Checklist"

        return (
          <div key={submission.id} className="rounded-lg border bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <span className="text-sm font-medium">{templateName}</span>
                {failedCount > 0 ? (
                  <Badge variant="destructive" className="ml-2">
                    {failedCount} issue{failedCount > 1 ? "s" : ""}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="ml-2">All OK</Badge>
                )}
              </div>
              <span className="text-xs text-gray-500">{formatDateTime(submission.created_at)}</span>
            </div>

            <div className="space-y-1">
              {submission.items.map((item) => (
                <div key={item.id} className="flex items-center gap-2 text-sm">
                  <span className={item.status === "not_ok" ? "text-red-600" : "text-green-600"}>
                    {item.status === "not_ok" ? "✗" : "✓"}
                  </span>
                  <span className={item.status === "not_ok" ? "" : "text-gray-600"}>{item.text}</span>
                </div>
              ))}
            </div>

            {(submission.submitted_by_name || submission.submitted_by_department || submission.notes) && (
              <div className="mt-3 border-t pt-2 text-xs text-gray-500">
                {submission.submitted_by_name && <span>By: {submission.submitted_by_name}</span>}
                {submission.submitted_by_department && <span> — {submission.submitted_by_department}</span>}
                {submission.notes && <p className="mt-1 italic">{submission.notes}</p>}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
