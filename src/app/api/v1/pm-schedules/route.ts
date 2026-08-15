import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireApiScope } from "@/lib/api/auth"

export async function GET(request: Request) {
  const auth = await requireApiScope(request, "read", "pm-schedules")
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  let query = supabase
    .schema("ebiomed")
    .from("pm_schedules")
    .select("*, equipment:equipment_id(name, tag_number, department, location)")
    .is("deleted_at", null)
    .order("next_due", { ascending: true })
  if (searchParams.get("active")) query = query.eq("active", searchParams.get("active") === "true")
  if (searchParams.get("equipment_id")) query = query.eq("equipment_id", searchParams.get("equipment_id"))
  const { data, error } = await query.limit(Math.min(Number(searchParams.get("limit") || 100), 500))
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, count: data?.length || 0 })
}
