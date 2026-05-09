import Link from "next/link"
import { CheckCircle } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default async function ReportSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ wo?: string }>
}) {
  const params = await searchParams
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
          <CardTitle className="text-xl">Fault Report Submitted</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            A work order has been created and the biomedical team will be notified.
          </p>
          {params.wo && (
            <p className="font-mono text-sm text-gray-500">Work Order: {params.wo.slice(0, 8)}</p>
          )}
          <div className="flex justify-center gap-3">
            <Link href="/report" className={cn(buttonVariants({ variant: "outline" }))}>Report Another</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
