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
  const status = searchParams.get("status")
  const department = searchParams.get("department")

  let query = supabase
    .from("equipment")
    .select("*")
    .is("deleted_at", null)
    .order("name")

  if (status) query = query.eq("status", status)
  if (department) query = query.eq("department", department)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, count: data?.length || 0 })
}
