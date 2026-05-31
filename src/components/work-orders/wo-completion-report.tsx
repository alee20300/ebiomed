import { getWorkOrderById } from "@/lib/actions/work-orders"
import { getJobCards } from "@/lib/actions/job-cards"
import { notFound } from "next/navigation"

function formatMinutes(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export async function WOCompletionReport({ id }: { id: string }) {
  const wo = await getWorkOrderById(id)
  if (!wo) notFound()

  const jobCards = await getJobCards(id)
  const completedCards = jobCards.filter((jc) => jc.status === "completed")

  const totalLabor = jobCards.reduce((sum, jc) => {
    return sum + (jc.entries?.reduce((s, e) => s + e.duration_minutes, 0) || 0)
  }, 0)

  const totalParts = jobCards.reduce((sum, jc) => {
    return sum + (jc.parts?.reduce((s, p) => s + p.quantity_used, 0) || 0)
  }, 0)

  return (
    <div className="mx-auto max-w-[210mm] bg-white p-8 print:p-0">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .report-container, .report-container * { visibility: visible; }
          .report-container { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="report-container">
        {/* Header */}
        <div className="mb-6 border-b-2 border-black pb-4 text-center">
          <h1 className="text-xl font-bold">BIOMEDICAL EQUIPMENT SERVICE REPORT</h1>
          <p className="mt-1 text-sm text-gray-600">Work Order #{id.slice(0, 8)}</p>
        </div>

        {/* Equipment Info */}
        <div className="mb-6 grid grid-cols-2 gap-1 text-sm">
          <div><strong>Equipment:</strong> {wo.equipment?.name || "-"}</div>
          <div><strong>Asset Tag:</strong> {wo.equipment?.tag_number || "-"}</div>
          <div><strong>Department:</strong> {wo.equipment?.department || "-"}</div>
          <div><strong>Serial:</strong> {wo.equipment?.serial_number || "-"}</div>
          <div><strong>WO Type:</strong> {wo.type}</div>
          <div><strong>Priority:</strong> {wo.priority}</div>
          <div><strong>Reported:</strong> {new Date(wo.created_at).toLocaleString()}</div>
          <div><strong>Completed:</strong> {wo.completed_at ? new Date(wo.completed_at).toLocaleString() : "-"}</div>
          <div className="col-span-2 mt-2"><strong>Fault Description:</strong> {wo.description}</div>
        </div>

        {/* Service Performed */}
        <div className="mb-6">
          <h2 className="mb-3 border-b pb-1 text-base font-bold">Service Performed</h2>

          {completedCards.length === 0 ? (
            <p className="text-sm text-gray-500">No completed job cards.</p>
          ) : (
            completedCards.map((jc) => {
              const jcMinutes = jc.entries?.reduce((s, e) => s + e.duration_minutes, 0) || 0
              const jcParts = jc.parts?.length || 0
              return (
                <div key={jc.id} className="mb-4 rounded border bg-gray-50 p-3 text-sm">
                  <div className="mb-1 flex justify-between">
                    <strong>Job Card</strong>
                    <span className="text-gray-600">
                      {jc.technician?.full_name || "Unknown"} · {new Date(jc.started_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="mb-2 text-xs text-gray-600">
                    <strong>Time:</strong> {formatMinutes(jcMinutes)} · <strong>Parts:</strong> {jcParts} items
                  </div>
                  <div className="text-sm"><strong>Work Done:</strong> {jc.summary}</div>
                  {jc.unresolved_issues && (
                    <div className="mt-1 text-sm text-red-700"><strong>Unresolved:</strong> {jc.unresolved_issues}</div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Totals */}
        <div className="mb-6 border-t-2 border-black pt-3 text-sm">
          <div className="flex justify-between"><span>Total Labor:</span><strong>{formatMinutes(totalLabor)}</strong></div>
          <div className="flex justify-between"><span>Total Parts Used:</span><strong>{totalParts} items</strong></div>
          <div className="flex justify-between"><span>Total Downtime:</span><strong>{wo.downtime_minutes ? formatMinutes(wo.downtime_minutes) : "N/A"}</strong></div>
        </div>

        {/* Signatures */}
        <div className="mt-10 flex justify-between border-t pt-4 text-sm">
          <div className="text-center">
            <div className="mb-1 w-40 border-b border-black">&nbsp;</div>
            <span className="text-xs text-gray-600">Technician Signature</span>
          </div>
          <div className="text-center">
            <div className="mb-1 w-40 border-b border-black">&nbsp;</div>
            <span className="text-xs text-gray-600">Supervisor Signature</span>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 border-t pt-2 text-center text-[10px] text-gray-400">
          Generated by eBiomed CMMS · Report ID: RPT-{id.slice(0, 8)}
        </div>
      </div>
    </div>
  )
}
