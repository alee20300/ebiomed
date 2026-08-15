import Link from "next/link"
import { CheckCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function ChecklistSuccessPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CheckCircle className="mx-auto h-16 w-16 text-success-strong" />
          <CardTitle className="text-xl">Checklist Submitted</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Your checklist has been recorded. If any issues were flagged, the biomedical team has been notified.
          </p>
          <div className="flex justify-center gap-3">
            <Link href="/report" className="text-sm text-primary hover:underline">
              Report a fault
            </Link>
            <span className="text-border">|</span>
            <Link href="/checklist" className="text-sm text-primary hover:underline">
              Scan another
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
