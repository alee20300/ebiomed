import { redirect } from "next/navigation"
import { Suspense } from "react"

import { getPurchasingDashboard } from "@/lib/actions/purchasing"
import { getCurrentUser } from "@/lib/actions/profiles"
import { PurchasingWorkspace } from "@/components/purchasing/purchasing-workspace"
import { Skeleton } from "@/components/ui/skeleton"

async function PurchasingContent() {
  const dashboard = await getPurchasingDashboard()
  return <PurchasingWorkspace {...dashboard} />
}

export default async function PurchasingPage() {
  const user = await getCurrentUser()
  if (user?.role === "viewer") redirect("/dashboard")

  return (
    <div>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <PurchasingContent />
      </Suspense>
    </div>
  )
}
