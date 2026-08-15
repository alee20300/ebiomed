import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireApiScope } from "@/lib/api/auth"

export async function GET(request: Request) {
  const auth = await requireApiScope(request, "read", "vendors")
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .schema("ebiomed")
    .from("vendors")
    .select("*, pricing:vendor_part_pricing(*, part:part_id(name, part_number))")
    .is("deleted_at", null)
    .order("name")
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, count: data?.length || 0 })
}
