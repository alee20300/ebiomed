"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { equipmentSchema } from "@/lib/schemas/equipment"
import type { Equipment } from "@/lib/types"

export async function createEquipment(formData: FormData) {
  const supabase = await createClient()
  const raw = Object.fromEntries(formData)

  const parsed = equipmentSchema.safeParse(raw)
  if (!parsed.success) {
    const messages = parsed.error.errors.map((e) => e.message).join(", ")
    return redirect(`/equipment/new?error=${encodeURIComponent(messages)}`)
  }

  const { error } = await supabase.from("equipment").insert(parsed.data)

  if (error) {
    return redirect(`/equipment/new?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath("/equipment")
  redirect("/equipment")
}

export async function updateEquipment(id: string, formData: FormData) {
  const supabase = await createClient()
  const raw = Object.fromEntries(formData)

  const parsed = equipmentSchema.partial().safeParse(raw)
  if (!parsed.success) {
    const messages = parsed.error.errors.map((e) => e.message).join(", ")
    return redirect(`/equipment/${id}?error=${encodeURIComponent(messages)}`)
  }

  const { error } = await supabase
    .from("equipment")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", id)

  if (error) {
    return redirect(`/equipment/${id}?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath("/equipment")
  revalidatePath(`/equipment/${id}`)
  redirect(`/equipment/${id}`)
}

export async function getEquipment(): Promise<Equipment[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("equipment")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) return []
  return data as Equipment[]
}

export async function getEquipmentById(id: string): Promise<Equipment | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("equipment")
    .select("*")
    .eq("id", id)
    .single()

  if (error) return null
  return data as Equipment[]
}
