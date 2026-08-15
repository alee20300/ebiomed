import { createAdminClient } from "@/lib/supabase/admin"
import { getOperationalHealth } from "@/lib/operations/health"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const health = await getOperationalHealth(createAdminClient())
    return Response.json(health, { status: health.status === "healthy" ? 200 : 503 })
  } catch (error) {
    return Response.json({
      status: "down",
      timestamp: new Date().toISOString(),
      checks: {
        environment: { status: "down", message: error instanceof Error ? error.message : "Health check failed" },
      },
    }, { status: 503 })
  }
}
