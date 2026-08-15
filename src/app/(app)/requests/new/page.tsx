import { redirect } from "next/navigation"

import { getEquipment } from "@/lib/actions/equipment"
import { getCurrentUser } from "@/lib/actions/profiles"
import { NewRequestForm } from "@/components/requests/new-request-form"
import { AlertTriangle } from "lucide-react"

export default async function NewRequestPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>
}) {
  const user = await getCurrentUser()
  if (!user) return redirect("/login")

  const [equipment, params] = await Promise.all([
    getEquipment(),
    searchParams,
  ])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">New Request</h2>
        <p className="text-sm text-muted-foreground">Create a fault request from inside the app environment.</p>
      </div>

      {params?.error && (
        <div className="flex items-center gap-2 rounded-lg border border-danger bg-danger-subtle p-3 text-sm text-danger-strong">
          <AlertTriangle className="h-4 w-4" />
          {params.error}
        </div>
      )}

      {equipment.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
          No equipment is available for request creation.
        </div>
      ) : (
        <NewRequestForm equipment={equipment} user={user} />
      )}
    </div>
  )
}
