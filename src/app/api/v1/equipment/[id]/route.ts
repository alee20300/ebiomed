import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { verifyApiKey, extractApiKey } from "@/lib/api/auth"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const key = extractApiKey(request)
  const { valid } = await verifyApiKey(key || "")
  if (!valid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("equipment")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: "Equipment not found" }, { status: 404 })
  }

  const { data: certs } = await supabase
    .from("certificates")
    .select("certificate_number, issued_at, valid_until, status")
    .eq("equipment_id", id)
    .eq("status", "valid")
    .order("issued_at", { ascending: false })
    .limit(1)

  return NextResponse.json({
    data: {
      ...data,
      current_certificate: certs?.[0] || null,
    },
  })
}
