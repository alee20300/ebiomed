"use client"

import { useState } from "react"
import { saveChecklistTemplate, deleteChecklistTemplate } from "@/lib/actions/checklist"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { ChecklistTemplate } from "@/lib/types"
import { Trash2, Plus, Check } from "lucide-react"

type FieldType = "checkbox" | "number" | "combobox"

interface TaskDraft {
  id: string
  text: string
  type: FieldType
  required: boolean
  options: string[]
}

interface Props {
  equipmentId: string
  templates: ChecklistTemplate[]
}

let taskIdCounter = 1000

export function ChecklistTemplateManager({ equipmentId, templates }: Props) {
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState("")
  const [newFreq, setNewFreq] = useState("daily")
  const [newTasks, setNewTasks] = useState<TaskDraft[]>([
    { id: `${++taskIdCounter}`, text: "", type: "checkbox", required: true, options: [] },
  ])

  const addTask = () => {
    setNewTasks([...newTasks, { id: `${++taskIdCounter}`, text: "", type: "checkbox", required: false, options: [] }])
  }

  const removeTask = (id: string) => {
    if (newTasks.length <= 1) return
    setNewTasks(newTasks.filter((t) => t.id !== id))
  }

  const updateTask = <K extends keyof TaskDraft>(id: string, field: K, value: TaskDraft[K]) => {
    setNewTasks(newTasks.map((t) => (t.id === id ? { ...t, [field]: value } : t)))
  }

  const itemsJson = JSON.stringify(
    newTasks.filter((t) => t.text.trim()).map((t, i) => ({
      id: `item-${i}`,
      text: t.text.trim(),
      type: t.type,
      required: t.required,
      options: t.options.length > 0 ? t.options : undefined,
    }))
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">End-User Checklists</h4>
        {!showNew && (
          <Button type="button" variant="outline" size="sm" onClick={() => setShowNew(true)}>
            <Plus className="mr-1 h-4 w-4" /> Add Template
          </Button>
        )}
      </div>

      {templates.length === 0 && !showNew && (
        <p className="text-sm text-muted-foreground">No checklist templates defined.</p>
      )}

      {templates.map((tpl) => (
        <div key={tpl.id} className="rounded-lg border bg-muted p-4">
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
              <Label htmlFor={`items-${tpl.id}`}>
                Checklist Items
                {tpl.items.some((i) => i.type && i.type !== "checkbox")
                  ? " (configured with custom types below)"
                  : ""}
              </Label>
              <Textarea
                id={`items-${tpl.id}`}
                name="items"
                rows={3}
                defaultValue={tpl.items.map((i) => i.text).join("\n")}
                placeholder="Equipment exterior is clean&#10;Power cord is undamaged"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" variant="secondary" size="sm">Save</Button>
              <form action={deleteChecklistTemplate.bind(null, tpl.id, equipmentId)}>
                <Button type="submit" variant="outline" size="sm">
                  <Trash2 className="mr-1 h-3 w-3" /> Delete
                </Button>
              </form>
            </div>
          </form>
        </div>
      ))}

      {showNew && (
        <div className="rounded-lg border bg-muted p-4">
          <form action={saveChecklistTemplate} className="space-y-4">
            <input type="hidden" name="equipment_id" value={equipmentId} />
            <input type="hidden" name="items" value={itemsJson} />

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="name-new">Name</Label>
                <Input
                  id="name-new"
                  name="name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Daily Safety Check"
                  required
                />
              </div>
              <div>
                <Label htmlFor="freq-new">Frequency</Label>
                <select
                  id="freq-new"
                  name="frequency"
                  value={newFreq}
                  onChange={(e) => setNewFreq(e.target.value)}
                  className="h-9 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            </div>

            {/* Task builder */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label>Checklist tasks</Label>
                <button type="button" onClick={addTask} className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80">
                  <Plus className="h-3 w-3" /> Add task
                </button>
              </div>
              <div className="space-y-2">
                {newTasks.map((task) => (
                  <div key={task.id} className="rounded-lg border bg-white p-2">
                    <div className="mb-1 flex items-center gap-2">
                      <Input
                        value={task.text}
                        onChange={(e) => updateTask(task.id, "text", e.target.value)}
                        placeholder={`Task ${task.id}`}
                        className="h-8 flex-1 text-sm"
                      />
                      <select
                        value={task.type}
                        onChange={(e) => updateTask(task.id, "type", e.target.value as FieldType)}
                        className="h-8 w-24 rounded-lg border border-input bg-card px-2 text-xs"
                      >
                        <option value="checkbox">Checkbox</option>
                        <option value="number">Number</option>
                        <option value="combobox">Combobox</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => updateTask(task.id, "required", !task.required)}
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs ${
                          task.required ? "bg-info-subtle text-primary" : "bg-neutral-subtle text-muted-foreground"
                        }`}
                      >
                        {task.required ? <Check className="h-3 w-3" /> : "−"}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeTask(task.id)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-danger-subtle hover:text-danger-strong"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                    {task.type === "combobox" && (
                      <div className="mt-1 flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">Options:</span>
                        <Input
                          value={(task.options || []).join(", ")}
                          onChange={(e) =>
                            updateTask(
                              task.id,
                              "options",
                              e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                            )
                          }
                          placeholder="Good, Fair, Poor"
                          className="h-7 flex-1 text-xs"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="submit" variant="secondary" size="sm" disabled={!newName.trim()}>Create</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setShowNew(false)}>Cancel</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
