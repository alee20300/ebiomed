import { NextResponse } from "next/server"
import { generatePMWorkOrdersWithClient } from "@/lib/actions/pm-engine"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const result = await generatePMWorkOrdersWithClient(createAdminClient())
  return NextResponse.json({
    checkedSchedules: result.checked,
    createdOccurrences: result.createdOccurrences,
    processedOccurrences: result.processed,
    generatedWorkOrders: result.generated,
    escalations: result.escalated,
    missedOccurrences: result.missed,
    failures: result.failures,
    failureDetails: result.failureDetails,
  })
}
