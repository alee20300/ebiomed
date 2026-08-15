"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { logAudit } from "@/lib/actions/audit"

function safeNextPath(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/dashboard"
}

export async function login(formData: FormData) {
  const supabase = await createClient()
  const next = safeNextPath(formData.get("next"))

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  })

  if (error) {
    return redirect(`/login?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}`)
  }

  revalidatePath("/", "layout")
  redirect(next)
}

export async function loginWithAuthentik(formData: FormData) {
  const supabase = await createClient()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://192.168.1.6:3002"
  const next = safeNextPath(formData.get("next"))

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "keycloak",
    options: {
      redirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}`,
      scopes: "openid profile email",
    },
  })

  if (error || !data.url) {
    redirect(`/login?error=${encodeURIComponent(error?.message ?? "Authentik sign-in is unavailable")}&next=${encodeURIComponent(next)}`)
  }

  // GoTrue reaches the HTTP-only local OIDC bridge through localhost. Replace
  // only that origin before sending the browser there so LAN devices do not
  // try to open their own localhost.
  const authentikUrl = process.env.AUTHENTIK_BROWSER_URL ?? "http://192.168.1.6:9003"
  redirect(data.url.replace("http://localhost:9003", authentikUrl))
}

export async function signup(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const fullName = formData.get("fullName") as string
  const role = (formData.get("role") as string) || "technician"

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  })

  if (error) {
    return redirect("/login?error=" + encodeURIComponent(error.message))
  }

  if (data.user) {
    await supabase.schema("ebiomed").from("profiles").insert({
      id: data.user.id,
      full_name: fullName,
      role,
    })

    await logAudit("profiles", data.user.id, "insert", [
      { newValue: JSON.stringify({ full_name: fullName, role }) }
    ], "User account created via signup")
  }

  redirect("/login?message=Check your email to confirm your account")
}

export async function signout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath("/", "layout")
  redirect("/login")
}

export async function getCurrentUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .schema("ebiomed")
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  return { ...user, ...profile }
}

export async function getProfiles() {
  const supabase = await createClient()
  const { data } = await supabase
    .schema("ebiomed")
    .from("profiles")
    .select("*")
    .order("full_name")

  return (data || []) as Array<{
    id: string
    full_name: string | null
    role: string
    department: string | null
    phone: string | null
  }>
}
