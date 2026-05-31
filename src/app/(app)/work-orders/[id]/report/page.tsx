import Link from "next/link"
import { WOCompletionReport } from "@/components/work-orders/wo-completion-report"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ChevronLeft, Printer } from "lucide-react"

export default async function WOReportPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <div className="space-y-4">
      <div className="no-print flex items-center gap-2">
        <Link href={`/work-orders/${id}`} className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}>
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h2 className="text-2xl font-bold tracking-tight">Completion Report</h2>
        <button
          onClick={() => window.print()}
          className={cn(buttonVariants({ variant: "outline" }), "ml-auto")}
        >
          <Printer className="mr-2 h-4 w-4" />
          Print Report
        </button>
      </div>
      <WOCompletionReport id={id} />
    </div>
  )
}
