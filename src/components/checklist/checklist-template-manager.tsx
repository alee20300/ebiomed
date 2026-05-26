"use client"

import { saveChecklistTemplate, deleteChecklistTemplate } from "@/lib/actions/checklist"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { ChecklistTemplate } from "@/lib/types"
import { Trash2, Plus } from "lucide-react"
import { useState } from "react"

interface Props {
  equipmentId: string
  templates: ChecklistTemplate[]
}

export function ChecklistTemplateManager({ equipmentId, templates }: Props) {
  const [showNew, setShowNew] = useState(false)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">End-User Checklists</h4>
        {!showNew && (
          <Button type="button" variant="outline" size="sm" onClick={() => setShowNew(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Add Template
          </Button>
        )}
      </div>

      {templates.length === 0 && !showNew && (
        <p className="text-sm text-gray-500">
          No checklist templates defined. End users will not be able to fill checklists for this equipment.
        </p>
      )}

      {templates.map((tpl) => (
        <div key={tpl.id} className="rounded-lg border bg-gray-50 p-4">
          <form action={saveChecklistTemplate} className="space-y-3">
            <input type="hidden" name="equipment_id" value={equipmentId} />
            <input type="hidden" name="template_id" value={tpl.id} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor={`name-${tpl.id}`}>Name</Label>
                <Input id={`name-${tpl.id}`} name="name" defaultValue={tpl.name} />
              </div>
              <div>
                <Label htmlFor={`freq-${tpl.id}`}>Frequency</Label>
                <select
                  id={`freq-${tpl.id}`}
                  name="frequency"
                  defaultValue={tpl.frequency}
                  className="h-9 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            </div>
            <div>
              <Label htmlFor={`items-${tpl.id}`}>Checklist Items (one per line)</Label>
              <Textarea
                id={`items-${tpl.id}`}
                name="items"
                rows={4}
                defaultValue={tpl.items.map((i) => i.text).join("\n")}
                placeholder="Equipment exterior is clean&#10;Power cord is undamaged&#10;Display screen is readable"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" variant="secondary" size="sm">Save</Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                formAction={deleteChecklistTemplate.bind(null, tpl.id, equipmentId)}
              >
                <Trash2 className="mr-1 h-3 w-3" />
                Delete
              </Button>
            </div>
          </form>
        </div>
      ))}

      {showNew && (
        <div className="rounded-lg border bg-gray-50 p-4">
          <form action={saveChecklistTemplate} className="space-y-3">
            <input type="hidden" name="equipment_id" value={equipmentId} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="name-new">Name</Label>
                <Input id="name-new" name="name" placeholder="Daily Safety Check" required />
              </div>
              <div>
                <Label htmlFor="freq-new">Frequency</Label>
                <select
                  id="freq-new"
                  name="frequency"
                  defaultValue="daily"
                  className="h-9 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            </div>
            <div>
              <Label htmlFor="items-new">Checklist Items (one per line)</Label>
              <Textarea
                id="items-new"
                name="items"
                rows={4}
                placeholder="Equipment exterior is clean&#10;Power cord is undamaged&#10;Display screen is readable"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" variant="secondary" size="sm">Create</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setShowNew(false)}>Cancel</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
