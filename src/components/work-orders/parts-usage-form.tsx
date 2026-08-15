"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { consumeParts } from "@/lib/actions/parts"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { enqueueOfflineDraft, type PartsUsageDraftPayload } from "@/lib/offline/work-order-drafts"
import type { Part } from "@/lib/types"

interface Props {
  workOrderId: string
}

export function PartsUsageForm({ workOrderId }: Props) {
  const [parts, setParts] = useState<Part[]>([])
  const [message, setMessage] = useState("")
  const supabase = createClient()

  useEffect(() => {
    supabase
      .schema("ebiomed")
      .from("parts")
      .select("*")
      .order("name")
      .then(({ data }) => setParts((data || []) as Part[]))
  }, [supabase])

  return (
    <form
      action={async (formData) => {
        setMessage("")
        if (!navigator.onLine) {
          const payload: PartsUsageDraftPayload = {
            workOrderId,
            partId: String(formData.get("part_id") || ""),
            quantityUsed: Number(formData.get("quantity_used") || 0),
            reason: String(formData.get("reason") || ""),
          }
          await enqueueOfflineDraft("parts_usage", workOrderId, payload)
          setMessage("Offline parts usage saved.")
          return
        }
        await consumeParts(formData)
      }}
      className="space-y-4"
    >
      <input type="hidden" name="work_order_id" value={workOrderId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="part_id">Part</Label>
          <Select name="part_id">
            <SelectTrigger><SelectValue placeholder="Select part..." /></SelectTrigger>
            <SelectContent>
              {parts.map((part) => (
                <SelectItem key={part.id} value={part.id}>
                  {part.name} ({part.quantity_on_hand} in stock)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="quantity_used">Quantity Used</Label>
          <Input id="quantity_used" name="quantity_used" type="number" min={1} required />
        </div>
      </div>
      <div>
        <Label htmlFor="parts_reason">Reason</Label>
        <Input
          id="parts_reason"
          name="reason"
          minLength={5}
          required
          placeholder="Repair parts used"
        />
      </div>
      <Button type="submit" size="sm">Log Parts Used</Button>
      {message && <p className="text-xs text-muted-foreground">{message}</p>}
    </form>
  )
}
