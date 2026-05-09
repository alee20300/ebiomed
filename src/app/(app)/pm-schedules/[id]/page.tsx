import Link from "next/link"
import { notFound } from "next/navigation"
import { getPMScheduleById } from "@/lib/actions/pm-schedules"
import { PMDetailCard } from "@/components/pm-schedules/pm-detail-card"
import { ChevronLeft } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default async function PMScheduleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const pm = await getPMScheduleById(id)

  if (!pm) notFound()

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/pm-schedules" className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}>
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h2 className="text-2xl font-bold tracking-tight">PM Schedule Detail</h2>
      </div>
      <div className="rounded-lg border bg-white p-6">
        <PMDetailCard pmSchedule={pm} />
      </div>
    </div>
  )
}
