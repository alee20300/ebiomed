import { createClient } from "@/lib/supabase/server"
import { createHash } from "crypto"

export async function verifyApiKey(
  key: string
): Promise<{ valid: boolean; keyId?: string; scopes?: string[]; resources?: string[] }> {
  if (!key) return { valid: false }

  const supabase = await createClient()
  const keyHash = createHash("sha256").update(key).digest("hex")

  const { data } = await supabase
    .from("api_keys")
    .select("id, expires_at, scopes, allowed_resources")
    .eq("key_hash", keyHash)
    .eq("active", true)
    .single()

  if (!data) return { valid: false }

  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { valid: false }
  }

  await supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)

  return { valid: true, keyId: data.id, scopes: data.scopes || [], resources: data.allowed_resources || [] }
}

async function recordApiUsageEvent(params: {
  keyId?: string
  outcome: "accepted" | "rejected"
  resource?: string
  scopes?: string[]
  failureReason?: string
  request: Request
}) {
  const supabase = await createClient()
  await supabase.from("api_key_usage_events").insert({
    api_key_id: params.keyId || null,
    outcome: params.outcome,
    resource: params.resource || null,
    scopes: params.scopes || [],
    ip_address: params.request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    user_agent: params.request.headers.get("user-agent") || null,
    failure_reason: params.failureReason || null,
  })
}

export function extractApiKey(request: Request): string | null {
  const auth = request.headers.get("authorization")

  if (auth?.startsWith("Bearer ")) {
    return auth.slice(7)
  }

  const url = new URL(request.url)
  const paramKey = url.searchParams.get("api_key")
  if (paramKey) return paramKey

  return null
}

export function hasApiScope(
  auth: { valid: boolean; scopes?: string[]; resources?: string[] },
  action: "read" | "write",
  resource: string
) {
  if (!auth.valid) return false
  const scopes = auth.scopes || []
  const resources = auth.resources || []
  const scoped = scopes.includes(`${action}:*`) || scopes.includes(`${action}:${resource}`) || scopes.includes("*")
  const allowedResource = resources.includes("*") || resources.includes(resource)
  return scoped && allowedResource
}

export async function requireApiScope(request: Request, action: "read" | "write", resource: string) {
  const key = extractApiKey(request)
  const auth = await verifyApiKey(key || "")
  const allowed = hasApiScope(auth, action, resource)
  await recordApiUsageEvent({
    keyId: auth.keyId,
    outcome: allowed ? "accepted" : "rejected",
    resource,
    scopes: auth.scopes,
    failureReason: allowed ? undefined : auth.valid ? "scope_denied" : "invalid_or_expired_key",
    request,
  })
  return allowed ? auth : null
}
