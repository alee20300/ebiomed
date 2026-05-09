"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export async function login(formData: FormData) {
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  })

  if (error) {
    return redirect("/login?error=" + encodeURIComponent(error.message))
  }

  revalidatePath("/", "layout")
  redirect("/dashboard")
}

export async function signup(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const fullName = formData.get("fullName") as string
  const role = (formData.get("role") as string) || "technician"

  const { data, error } = await supabase.auth.signUp({ email, password })

  if (error) {
    return redirect("/login?error=" + encodeURIComponent(error.message))
  }

  if (data.user) {
    await supabase.schema("public").from("profiles").insert({
      id: data.user.id,
      full_name: fullName,
      role,
    })
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
    .schema("public")
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  return { ...user, ...profile }
}

export async function getProfiles() {
  const supabase = await createClient()
  const { data } = await supabase
    .schema("public")
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
