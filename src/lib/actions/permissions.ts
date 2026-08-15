"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/lib/actions/profiles"
import { logAudit } from "@/lib/actions/audit"
import type { PermissionAuditEntry, PermissionGrant, Site } from "@/lib/types"
import { resolvePermissionFromGrants, type PermissionRequest } from "@/lib/utils/permissions"

async function requireAdmin() {
  const user = await getCurrentUser()
  if (!user || user.role !== "admin") return redirect("/dashboard")
  return user
}

export async function hasPermission(request: PermissionRequest) {
  const user = await getCurrentUser()
  if (!user) return false

  const supabase = await createClient()
  const { data: grants } = await supabase
    .schema("ebiomed")
    .from("permission_grants")
    .select("*")
    .eq("profile_id", user.id)
    .in("action", [request.action, "*"])
    .in("resource", [request.resource, "*"])
    .in("scope_type", [request.scopeType || "global", "global"])

  return resolvePermissionFromGrants(user.role, request, (grants || []) as PermissionGrant[])
}

export async function requirePermission(request: PermissionRequest, redirectTo = "/dashboard") {
  if (await hasPermission(request)) return
  redirect(`${redirectTo}?error=${encodeURIComponent("You do not have permission for that action")}`)
}

export async function getPermissionAdminData() {
  const supabase = await createClient()
  const [{ data: grants }, { data: audit }, { data: sites }] = await Promise.all([
    supabase
      .schema("ebiomed")
      .from("permission_grants")
      .select("*, profile:profile_id(full_name, role)")
      .order("updated_at", { ascending: false }),
    supabase
      .schema("ebiomed")
      .from("permission_audit")
      .select("*, profile:profile_id(full_name), changed_by_profile:changed_by(full_name)")
      .order("changed_at", { ascending: false })
      .limit(20),
    supabase.schema("ebiomed").from("sites").select("*").order("name"),
  ])

  return {
    grants: (grants || []) as PermissionGrant[],
    audit: (audit || []) as PermissionAuditEntry[],
    sites: (sites || []) as Site[],
  }
}

export async function savePermissionGrant(formData: FormData) {
  const user = await requireAdmin()
  await requirePermission({ action: "write", resource: "permissions" }, "/settings")
  const supabase = await createClient()
  const payload = {
    profile_id: String(formData.get("profile_id") || ""),
    action: String(formData.get("action") || "").trim(),
    resource: String(formData.get("resource") || "").trim(),
    scope_type: String(formData.get("scope_type") || "global"),
    scope_id: String(formData.get("scope_id") || "") || null,
    granted: formData.get("granted") !== "false",
    reason: String(formData.get("reason") || "").trim(),
    created_by: user.id,
  }
  if (!payload.profile_id || !payload.action || !payload.resource || payload.reason.length < 5) {
    return redirect(`/settings?error=${encodeURIComponent("User, action, resource, and reason are required")}`)
  }

  let oldGrantQuery = supabase
    .schema("ebiomed")
    .from("permission_grants")
    .select("*")
    .eq("profile_id", payload.profile_id)
    .eq("action", payload.action)
    .eq("resource", payload.resource)
    .eq("scope_type", payload.scope_type)
  oldGrantQuery = payload.scope_id
    ? oldGrantQuery.eq("scope_id", payload.scope_id)
    : oldGrantQuery.is("scope_id", null)
  const { data: oldGrant } = await oldGrantQuery.maybeSingle()

  const write = oldGrant
    ? supabase
      .schema("ebiomed")
      .from("permission_grants")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", oldGrant.id)
      .select()
      .single()
    : supabase
      .schema("ebiomed")
      .from("permission_grants")
      .insert(payload)
      .select()
      .single()

  const { data, error } = await write

  if (error) return redirect(`/settings?error=${encodeURIComponent(error.message)}`)

  await supabase.schema("ebiomed").from("permission_audit").insert({
    permission_grant_id: data.id,
    profile_id: payload.profile_id,
    action: payload.action,
    resource: payload.resource,
    scope_type: payload.scope_type,
    scope_id: payload.scope_id,
    old_granted: oldGrant?.granted ?? null,
    new_granted: payload.granted,
    changed_by: user.id,
    reason: payload.reason,
  })

  await logAudit("permission_grants", data.id, oldGrant ? "update" : "insert", [
    { newValue: JSON.stringify(payload), oldValue: oldGrant ? JSON.stringify(oldGrant) : null },
  ], payload.reason)
  revalidatePath("/settings")
  redirect("/settings")
}
