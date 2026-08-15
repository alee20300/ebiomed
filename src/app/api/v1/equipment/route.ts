import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireApiScope } from "@/lib/api/auth"

export async function GET(request: Request) {
  const auth = await requireApiScope(request, "read", "equipment")
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const status = searchParams.get("status")
  const department = searchParams.get("department")
  const assetCriticality = searchParams.get("asset_criticality")
  const riskClass = searchParams.get("risk_class")
  const networkConnected = searchParams.get("network_connected")
  const lifecycleStage = searchParams.get("lifecycle_stage")
  const patchStatus = searchParams.get("patch_status")
  const riskAcceptanceStatus = searchParams.get("risk_acceptance_status")
  const commissioningStatus = searchParams.get("commissioning_status")
  const decommissioningStatus = searchParams.get("decommissioning_status")

  let query = supabase
    .from("equipment")
    .select("*")
    .is("deleted_at", null)
    .order("name")

  if (status) query = query.eq("status", status)
  if (department) query = query.eq("department", department)
  if (assetCriticality) query = query.eq("asset_criticality", assetCriticality)
  if (riskClass) query = query.eq("risk_class", riskClass)
  if (lifecycleStage) query = query.eq("lifecycle_stage", lifecycleStage)
  if (patchStatus) query = query.eq("patch_status", patchStatus)
  if (riskAcceptanceStatus) query = query.eq("risk_acceptance_status", riskAcceptanceStatus)
  if (commissioningStatus) query = query.eq("commissioning_status", commissioningStatus)
  if (decommissioningStatus) query = query.eq("decommissioning_status", decommissioningStatus)
  if (networkConnected === "true" || networkConnected === "false") {
    query = query.eq("network_connected", networkConnected === "true")
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, count: data?.length || 0 })
}
