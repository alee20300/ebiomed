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

  if (!body.equipment_id || !body.description) {
    return NextResponse.json({ error: "equipment_id and description are required" }, { status: 400 })
  }

  if (typeof body.description !== "string" || body.description.length < 10) {
    return NextResponse.json({ error: "description must be at least 10 characters" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("work_orders")
    .insert({
      equipment_id: body.equipment_id,
      type: "corrective",
      priority: body.priority || "medium",
      status: "open",
      description: body.description,
      reported_by_name: body.reported_by_name || null,
      reported_by_department: body.reported_by_department || null,
      created_by: body.created_by || "00000000-0000-0000-0000-000000000000",
    })
    .select("id, equipment_id, status, created_at")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}
