import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireApiScope } from "@/lib/api/auth"

export async function GET(request: Request) {
  const auth = await requireApiScope(request, "read", "inventory")
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const report = searchParams.get("report") || "value"
  const source =
    report === "low-stock" ? "low_stock_report" :
    report === "usage" ? "parts_usage_report" :
    report === "reorder" ? "reorder_suggestions" :
    "inventory_value_report"

  let query = supabase.schema("ebiomed").from(source).select("*")
  if (report === "usage") {
    if (searchParams.get("work_order_id")) query = query.eq("work_order_id", searchParams.get("work_order_id"))
    if (searchParams.get("equipment_id")) query = query.eq("equipment_id", searchParams.get("equipment_id"))
  }
  const { data, error } = await query.limit(Math.min(Number(searchParams.get("limit") || 500), 1000))
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, count: data?.length || 0 })
}
