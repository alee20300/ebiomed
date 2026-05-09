"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { commentSchema } from "@/lib/schemas/comment"
import { getCurrentUser } from "@/lib/actions/profiles"
import type { WoComment } from "@/lib/types"

export async function addComment(formData: FormData) {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) return redirect("/login")

  const raw = Object.fromEntries(formData)

  const parsed = commentSchema.safeParse(raw)
  if (!parsed.success) {
    const messages = parsed.error.errors.map((e) => e.message).join(", ")
    return redirect(`/work-orders/${raw.work_order_id}?error=${encodeURIComponent(messages)}`)
  }

  const { error } = await supabase
    .schema("ebiomed")
    .from("wo_comments")
    .insert({
      work_order_id: parsed.data.work_order_id,
      author_id: user.id,
      text: parsed.data.text,
    })

  if (error) {
    return redirect(`/work-orders/${raw.work_order_id}?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`/work-orders/${parsed.data.work_order_id}`)
  redirect(`/work-orders/${parsed.data.work_order_id}`)
}

export async function getComments(workOrderId: string): Promise<WoComment[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .schema("ebiomed")
    .from("wo_comments")
    .select("*, author:author_id(full_name, role)")
    .eq("work_order_id", workOrderId)
    .order("created_at", { ascending: true })

  return (data || []) as unknown as WoComment[]
}
