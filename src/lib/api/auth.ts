import { createClient } from "@/lib/supabase/server"
import { createHash } from "crypto"

export async function verifyApiKey(
  key: string
): Promise<{ valid: boolean; keyId?: string }> {
  if (!key) return { valid: false }

  const supabase = await createClient()
  const keyHash = createHash("sha256").update(key).digest("hex")

  const { data } = await supabase
    .from("api_keys")
    .select("id, expires_at")
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

  return { valid: true, keyId: data.id }
}

export function extractApiKey(request: Request): string | null {
  const auth = request.headers.get("authorization")
  if (!auth) return null

  if (auth.startsWith("Bearer ")) {
    return auth.slice(7)
  }

  const url = new URL(request.url)
  const paramKey = url.searchParams.get("api_key")
  if (paramKey) return paramKey

  return null
}
