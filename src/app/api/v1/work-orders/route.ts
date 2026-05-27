import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { verifyApiKey, extractApiKey } from "@/lib/api/auth"

export async function GET(request: Request) {
  const key = extractApiKey(request)
  const { valid } = await verifyApiKey(key || "")
  if (!valid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = await createClient()
  const { searchParams } = new URL(request.url)

  let query = supabase
    .from("work_orders")
    .select("*, equipment:equipment_id(name, tag_number)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  const status = searchParams.get("status")
  const equipmentId = searchParams.get("equipment_id")
  const priority = searchParams.get("priority")
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100)

  if (status) query = query.eq("status", status)
  if (equipmentId) query = query.eq("equipment_id", equipmentId)
  if (priority) query = query.eq("priority", priority)

  query = query.limit(limit)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, count: data?.length || 0 })
}
