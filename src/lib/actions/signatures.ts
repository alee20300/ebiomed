"use server"

import { createClient } from "@/lib/supabase/server"

export async function verifyPassword(password: string): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return false

  const { error } = await supabase.auth.signInWithPassword({
    email: user.email,
    password,
  })

  return !error
}

export async function recordSignature(
  recordType: string,
  recordId: string,
  meaning: "Verified" | "Calibrated" | "Approved" | "Reviewed",
  recordHash?: string
): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from("signatures")
    .insert({
      signer_id: user.id,
      record_type: recordType,
      record_id: recordId,
      meaning,
      signature_hash: recordHash || null,
    })
    .select("id")
    .single()

  if (error) return null
  return data.id
}

export async function getSignatures(recordType: string, recordId: string) {
  const supabase = await createClient()

  const { data } = await supabase
    .from("signatures")
    .select("*, signer:signer_id(full_name, role)")
    .eq("record_type", recordType)
    .eq("record_id", recordId)
    .order("signed_at", { ascending: false })

  return data || []
}
