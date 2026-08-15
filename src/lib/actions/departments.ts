"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/lib/actions/profiles"
import { logAudit } from "@/lib/actions/audit"
import { departmentSchema, viewerDepartmentsSchema } from "@/lib/schemas/department"
import type { Department } from "@/lib/types"

async function requireAdmin() {
  const user = await getCurrentUser()
  if (!user || user.role !== "admin") {
    return redirect(`/dashboard?error=${encodeURIComponent("Admin access required")}`)
  }
  return user
}

export async function getAllDepartments(): Promise<Department[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("departments")
    .select("*")
    .order("name")

  if (error) return []
  return data as Department[]
}

export async function addDepartment(formData: FormData) {
  await requireAdmin()
  const supabase = await createClient()

  const raw = Object.fromEntries(formData)
  const parsed = departmentSchema.safeParse(raw)

  if (!parsed.success) {
    const messages = parsed.error.issues.map((e) => e.message).join(", ")
    return redirect(`/settings?error=${encodeURIComponent(messages)}`)
  }

  const { data, error } = await supabase
    .from("departments")
    .insert({ name: parsed.data.name.trim() })
    .select().single()

  if (error) {
    if (error.code === "23505") {
      return redirect(`/settings?error=${encodeURIComponent("Department already exists")}`)
    }
    return redirect(`/settings?error=${encodeURIComponent(error.message)}`)
  }

  await logAudit("departments", data.id, "insert", [
    { newValue: JSON.stringify({ name: parsed.data.name.trim() }) }
  ], parsed.data.reason)

  revalidatePath("/settings")
  redirect("/settings")
}

export async function deleteDepartment(id: string) {
  await requireAdmin()
  const supabase = await createClient()

  const { error } = await supabase
    .from("departments")
    .delete()
    .eq("id", id)

  if (error) {
    return redirect(`/settings?error=${encodeURIComponent(error.message)}`)
  }

  await logAudit("departments", id, "delete", [
    { field: "deleted", oldValue: id }
  ], "Department deleted")

  revalidatePath("/settings")
  redirect("/settings")
}

export async function getViewerDepartmentIds(viewerId: string): Promise<string[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("viewer_departments")
    .select("department_id")
    .eq("viewer_id", viewerId)

  if (error) return []
  return (data || []).map((row: { department_id: string }) => row.department_id)
}

export async function getViewerDepartments(viewerId: string): Promise<Department[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("viewer_departments")
    .select("department:department_id(*)")
    .eq("viewer_id", viewerId)

  if (error) return []
  return data.map((row: { department: unknown }) => (row as { department: Department }).department)
}

export async function saveViewerDepartments(formData: FormData) {
  await requireAdmin()
  const supabase = await createClient()

  const raw = Object.fromEntries(formData)
  const viewer_id = raw.viewer_id as string
  const department_ids = formData.getAll("department_ids") as string[]

  const parsed = viewerDepartmentsSchema.safeParse({ viewer_id, department_ids })

  if (!parsed.success) {
    const messages = parsed.error.issues.map((e) => e.message).join(", ")
    return redirect(`/settings?error=${encodeURIComponent(messages)}`)
  }

  // Atomic: delete all existing assignments, then insert new ones
  const { error: deleteError } = await supabase
    .from("viewer_departments")
    .delete()
    .eq("viewer_id", viewer_id)

  if (deleteError) {
    return redirect(`/settings?error=${encodeURIComponent(deleteError.message)}`)
  }

  if (department_ids.length > 0) {
    const rows = department_ids.map((dept_id) => ({
      viewer_id,
      department_id: dept_id,
    }))
    const { error: insertError } = await supabase.from("viewer_departments").insert(rows)
    if (insertError) {
      return redirect(`/settings?error=${encodeURIComponent(insertError.message)}`)
    }
  }

  await logAudit("viewer_departments", viewer_id, "update", [
    { newValue: JSON.stringify({ department_ids: department_ids }) }
  ], parsed.data.reason)

  revalidatePath("/settings")
  redirect("/settings")
}
