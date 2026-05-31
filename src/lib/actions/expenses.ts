"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/lib/actions/profiles"
import { getAppSetting } from "@/lib/actions/settings"
import { expenseSchema } from "@/lib/schemas/expense"

export async function addJobCardExpense(jobCardId: string, formData: FormData) {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) return redirect("/login")

  const enabled = await getAppSetting("expense_tracking_enabled")
  if (enabled !== true) {
    throw new Error("Expense tracking is disabled")
  }

  const raw = Object.fromEntries(formData)
  const parsed = expenseSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(", "))
  }

  let slipUrl: string | null = null
  const slip = formData.get("slip") as File | null
  if (slip && slip.size > 0) {
    const ext = slip.name.split(".").pop() || "jpg"
    const { data: expense, error: insertError } = await supabase
      .schema("ebiomed")
      .from("job_card_expenses")
      .insert({
        job_card_id: jobCardId,
        category: parsed.data.category,
        amount: parsed.data.amount,
        description: parsed.data.description,
      })
      .select("id")
      .single()

    if (insertError || !expense) throw new Error(insertError?.message || "Failed to add expense")

    const slipPath = `${jobCardId}/${expense.id}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from("expense-slips")
      .upload(slipPath, slip, { contentType: slip.type, upsert: true })

    if (!uploadError) {
      const { data: urlData } = await supabase.storage.from("expense-slips").createSignedUrl(slipPath, 3600)
      slipUrl = urlData?.signedUrl || null

      if (slipUrl) {
        await supabase
          .schema("ebiomed")
          .from("job_card_expenses")
          .update({ slip_url: slipUrl })
          .eq("id", expense.id)
      }
    }

    const { data: jc } = await supabase
      .schema("ebiomed")
      .from("job_cards")
      .select("work_order_id")
      .eq("id", jobCardId)
      .single()

    revalidatePath(`/work-orders/${jc?.work_order_id}`)
    return
  }

  const { error } = await supabase
    .schema("ebiomed")
    .from("job_card_expenses")
    .insert({
      job_card_id: jobCardId,
      category: parsed.data.category,
      amount: parsed.data.amount,
      description: parsed.data.description,
    })

  if (error) throw new Error(error.message)

  const { data: jc } = await supabase
    .schema("ebiomed")
    .from("job_cards")
    .select("work_order_id")
    .eq("id", jobCardId)
    .single()

  revalidatePath(`/work-orders/${jc?.work_order_id}`)
}

export async function deleteJobCardExpense(id: string) {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) return redirect("/login")

  const { data: expense } = await supabase
    .schema("ebiomed")
    .from("job_card_expenses")
    .select("job_card_id")
    .eq("id", id)
    .single()

  const { error } = await supabase
    .schema("ebiomed")
    .from("job_card_expenses")
    .delete()
    .eq("id", id)

  if (error) throw new Error(error.message)

  if (expense) {
    const { data: jc } = await supabase
      .schema("ebiomed")
      .from("job_cards")
      .select("work_order_id")
      .eq("id", expense.job_card_id)
      .single()

    revalidatePath(`/work-orders/${jc?.work_order_id}`)
  }
}
