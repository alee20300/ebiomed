import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { verifyApiKey, extractApiKey } from "@/lib/api/auth"

export async function POST(request: Request) {
  const key = extractApiKey(request)
  const { valid } = await verifyApiKey(key || "")
  if (!valid) {
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

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (body.run_hours !== undefined) {
    updates.run_hours = body.run_hours
  }
  if (body.cycle_count !== undefined) {
    updates.cycle_count = body.cycle_count
  }
  if (body.temperature_celsius !== undefined) {
    updates.last_telemetry_temp = body.temperature_celsius
  }

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
