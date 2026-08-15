import Link from "next/link"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

async function trackRequest(formData: FormData) {
  "use server"

  const reference = formData.get("reference")?.toString().trim().toUpperCase()
  if (!reference) redirect("/request-status")
  redirect(`/request-status/${encodeURIComponent(reference)}`)
}

export default function RequestStatusLookupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4">
      <div className="w-full max-w-md space-y-6 rounded-lg border bg-white p-6">
        <div>
          <Link href="/report" className="text-2xl font-bold text-primary">eBiomed</Link>
          <h1 className="mt-4 text-2xl font-bold text-foreground">Track Request</h1>
          <p className="mt-1 text-sm text-muted-foreground">Enter the tracking reference from your submission receipt.</p>
        </div>
        <form action={trackRequest} className="space-y-4">
          <div>
            <Label htmlFor="reference">Tracking Reference</Label>
            <Input
              id="reference"
              name="reference"
              required
              placeholder="REQ-20260605-ABC123"
              className="mt-1 font-mono uppercase"
            />
          </div>
          <Button type="submit" className="w-full">Track Status</Button>
        </form>
      </div>
    </div>
  )
}
