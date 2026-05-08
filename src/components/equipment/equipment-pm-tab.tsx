import Link from "next/link"
import { formatDate, getPMStatus } from "@/lib/utils/format"
import type { PMSchedule } from "@/lib/types"

interface Props {
  equipmentId: string
}

export async function EquipmentPMTab({ equipmentId }: Props) {
  const { createClient } = await import("@/lib/supabase/server")
  const supabase = await createClient()

  const { data } = await supabase
    .from("pm_schedules")
    .select("*")
    .eq("equipment_id", equipmentId)
    .eq("active", true)
    .order("next_due", { ascending: true })

  const schedules = (data || []) as PMSchedule[]

  if (schedules.length === 0) {
    return (
      <div className="py-8 text-center text-gray-500">
        No active PM schedules for this equipment.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {schedules.map((pm) => {
        const status = getPMStatus(pm.next_due)
        return (
          <Link
            key={pm.id}
            href={`/pm-schedules/${pm.id}`}
            className="flex items-center justify-between rounded-lg border p-3 hover:bg-gray-50"
          >
            <div>
              <p className="text-sm font-medium">
                Every {pm.frequency_days} days
                {pm.description && ` — ${pm.description}`}
              </p>
              <p className="text-xs text-gray-500">
                Last completed: {formatDate(pm.last_completed)}
              </p>
            </div>
            <div className="text-right">
              <p className={`text-sm font-medium ${
                status === "overdue" ? "text-red-600" :
                status === "due" ? "text-yellow-600" :
                "text-gray-600"
              }`}>
                {status === "overdue" ? "Overdue" :
                 status === "due" ? "Due today" :
                 status === "upcoming" ? "Due soon" : "Upcoming"}
              </p>
              <p className="text-xs text-gray-500">Next: {formatDate(pm.next_due)}</p>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
