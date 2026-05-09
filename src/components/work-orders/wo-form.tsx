"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { createWorkOrder } from "@/lib/actions/work-orders"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import type { Equipment } from "@/lib/types"

export function WorkOrderForm({ preselectedEquipmentId }: { preselectedEquipmentId?: string }) {
  const searchParams = useSearchParams()
  const error = searchParams.get("error")
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [technicians, setTechnicians] = useState<Array<{ id: string; full_name: string; role: string }>>([])
  const supabase = createClient()

  useEffect(() => {
    supabase
      .from("equipment")
      .select("*")
      .neq("status", "retired")
      .order("name")
      .then(({ data }) => setEquipment((data || []) as Equipment[]))

    supabase
      .schema("public")
      .from("profiles")
      .select("id, full_name, role")
      .in("role", ["technician", "admin"])
      .order("full_name")
      .then(({ data }) => setTechnicians((data as any) || []))
  }, [supabase])

  return (
    <form action={createWorkOrder} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div>
        <Label htmlFor="equipment_id">Equipment *</Label>
        <Select name="equipment_id" defaultValue={preselectedEquipmentId}>
          <SelectTrigger>
            <SelectValue placeholder="Select equipment..." />
          </SelectTrigger>
          <SelectContent>
            {equipment.map((eq) => (
              <SelectItem key={eq.id} value={eq.id}>
                {eq.tag_number} — {eq.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="type">Type</Label>
          <Select name="type" defaultValue="corrective">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="corrective">Corrective</SelectItem>
              <SelectItem value="preventive">Preventive</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="priority">Priority</Label>
          <Select name="priority" defaultValue="medium">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="description">Description *</Label>
        <Textarea
          id="description"
          name="description"
          rows={4}
          required
          placeholder="Describe the issue or maintenance needed..."
        />
      </div>

      <div>
        <Label htmlFor="assigned_to">Assign To</Label>
        <Select name="assigned_to">
          <SelectTrigger>
            <SelectValue placeholder="Unassigned" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Unassigned</SelectItem>
            {technicians.map((tech) => (
              <SelectItem key={tech.id} value={tech.id}>
                {tech.full_name} ({tech.role})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-3">
        <Button type="submit">
          Create Work Order
        </Button>
        <Button variant="outline" type="button" onClick={() => history.back()}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
