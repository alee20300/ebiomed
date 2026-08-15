"use server"

import { createClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/lib/actions/profiles"
import { requirePermission } from "@/lib/actions/permissions"
import { redirect } from "next/navigation"

export async function getAppSetting(key: string): Promise<unknown | null> {
  const supabase = await createClient()

  const { data } = await supabase
    .schema("ebiomed")
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .single()

  return data?.value ?? null
}

export async function updateAppSetting(key: string, value: unknown) {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) return redirect("/login")
  await requirePermission({ action: "write", resource: "settings" }, "/settings")

  const { error } = await supabase
    .schema("ebiomed")
    .from("app_settings")
    .upsert({ key, value, updated_by: user.id, updated_at: new Date().toISOString() })

  if (error) throw new Error(error.message)
}
