import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireApiScope } from "@/lib/api/auth"
import { buildTelemetryUpdates } from "@/lib/utils/telemetry"

export async function POST(request: Request) {
  const auth = await requireApiScope(request, "write", "telemetry")
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = await createClient()

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  if (!body.equipment_id) {
    return NextResponse.json({ error: "equipment_id is required" }, { status: 400 })
  }

  const updates = buildTelemetryUpdates(body, new Date().toISOString())

  if (Object.keys(updates).length <= 1) {
    return NextResponse.json({ error: "No valid telemetry fields provided" }, { status: 400 })
  }

  const { error } = await supabase
    .from("equipment")
    .update(updates)
    .eq("id", body.equipment_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
