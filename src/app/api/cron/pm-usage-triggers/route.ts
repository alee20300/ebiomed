import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = await createClient()

  const { data: equipment } = await supabase
    .from("equipment")
    .select("id, name, tag_number, run_hours, cycle_count, pm_trigger_type, pm_trigger_value")
    .neq("pm_trigger_type", "calendar")
    .not("pm_trigger_value", "is", null)
    .is("deleted_at", null)
    .in("status", ["active", "certified"])

  if (!equipment || equipment.length === 0) {
    return NextResponse.json({ processed: 0, created: 0 })
  }

  const { data: techs } = await supabase
    .from("profiles")
    .select("id")
    .in("role", ["admin", "technician"])
    .limit(1)

  const defaultTechId = techs?.[0]?.id
  let created = 0

  for (const equip of equipment) {
    const triggerType = equip.pm_trigger_type as string
    const triggerValue = equip.pm_trigger_value as number
    let shouldTrigger = false

    if (triggerType === "run_hours" && (equip.run_hours as number) >= triggerValue) {
      shouldTrigger = true
    } else if (triggerType === "cycles" && (equip.cycle_count as number) >= triggerValue) {
      shouldTrigger = true
    } else if (triggerType === "calendar_or_usage") {
      shouldTrigger = (equip.run_hours as number) >= triggerValue || (equip.cycle_count as number) >= triggerValue
    } else if (triggerType === "calendar_and_usage") {
      shouldTrigger = (equip.run_hours as number) >= triggerValue && (equip.cycle_count as number) >= triggerValue
    }

    if (!shouldTrigger) continue

    const description = triggerType === "run_hours"
      ? `Usage-based PM triggered: ${equip.run_hours} run hours reached (threshold: ${triggerValue}). Equipment: ${equip.name} (${equip.tag_number}).`
      : triggerType === "cycles"
        ? `Usage-based PM triggered: ${equip.cycle_count} cycles reached (threshold: ${triggerValue}). Equipment: ${equip.name} (${equip.tag_number}).`
        : `Usage-based PM triggered: run_hours=${equip.run_hours}, cycles=${equip.cycle_count}. Equipment: ${equip.name} (${equip.tag_number}).`

    const { data: wo, error } = await supabase
      .from("work_orders")
      .insert({
        equipment_id: equip.id,
        type: "preventive",
        priority: "medium",
        status: "open",
        description,
        created_by: defaultTechId || "00000000-0000-0000-0000-000000000000",
      })
      .select("id")
      .single()

    if (!error) {
      created++

      // Reset the usage counter so it doesn't trigger again immediately
      if (triggerType === "run_hours" || triggerType === "calendar_or_usage" || triggerType === "calendar_and_usage") {
        await supabase.from("equipment").update({ run_hours: 0 }).eq("id", equip.id)
      }
      if (triggerType === "cycles" || triggerType === "calendar_or_usage" || triggerType === "calendar_and_usage") {
        await supabase.from("equipment").update({ cycle_count: 0 }).eq("id", equip.id)
      }
    }
  }

  return NextResponse.json({ processed: equipment.length, created })
}
