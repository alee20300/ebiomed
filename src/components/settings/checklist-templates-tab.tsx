"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { saveChecklistTemplate, deleteChecklistTemplate } from "@/lib/actions/checklist"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Plus, Trash2, Pencil, Check, X } from "lucide-react"
import type { ChecklistTemplate, Equipment } from "@/lib/types"

type FieldType = "checkbox" | "number" | "combobox"
type ChecklistTemplateWithEquipment = ChecklistTemplate & {
  equipment?: Pick<Equipment, "name" | "tag_number"> | null
}

interface TaskDraft {
  id: string
  text: string
  type: FieldType
  required: boolean
  options: string[]
}

let ctr = 5000

interface Props {
  initialTemplates: ChecklistTemplate[]
}

export function ChecklistTemplatesTab({ initialTemplates }: Props) {
  const supabase = createClient()
  const [templates, setTemplates] = useState(initialTemplates)
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  const [selEquipment, setSelEquipment] = useState("")
  const [tmplName, setTmplName] = useState("")
  const [tmplFreq, setTmplFreq] = useState("daily")
  const [tasks, setTasks] = useState<TaskDraft[]>([
    { id: `${++ctr}`, text: "", type: "checkbox", required: true, options: [] },
  ])

  useEffect(() => {
    supabase.from("equipment").select("*").order("name").then(({ data }) =>
      setEquipment((data || []) as Equipment[])
    )
  }, [])

  const openNew = () => {
    setEditId(null)
    setSelEquipment("")
    setTmplName("")
    setTmplFreq("daily")
    setTasks([{ id: `${++ctr}`, text: "", type: "checkbox", required: true, options: [] }])
    setDialogOpen(true)
  }

  const openEdit = (tpl: ChecklistTemplate) => {
    setEditId(tpl.id)
    setSelEquipment(tpl.equipment_id)
    setTmplName(tpl.name)
    setTmplFreq(tpl.frequency)
    setTasks(
      tpl.items.map((item) => ({
        id: item.id,
        text: item.text,
        type: item.type || "checkbox",
        required: item.required ?? false,
        options: item.options || [],
      }))
    )
    setDialogOpen(true)
  }

  const addTask = () => {
    setTasks([...tasks, { id: `${++ctr}`, text: "", type: "checkbox", required: false, options: [] }])
  }

  const removeTask = (id: string) => {
    if (tasks.length <= 1) return
    setTasks(tasks.filter((t) => t.id !== id))
  }

  const updateTask = <K extends keyof TaskDraft>(id: string, field: K, value: TaskDraft[K]) => {
    setTasks(tasks.map((t) => (t.id === id ? { ...t, [field]: value } : t)))
  }

  const buildItemsJson = () =>
    JSON.stringify(
      tasks.filter((t) => t.text.trim()).map((t, i) => ({
        id: `item-${i}`,
        text: t.text.trim(),
        type: t.type,
        required: t.required,
        options: t.options.length > 0 ? t.options : undefined,
      }))
    )

  const refresh = () => {
    supabase
      .from("checklist_templates")
      .select("*, equipment:equipment_id(name, tag_number)")
      .order("created_at", { ascending: false })
      .then(({ data }) => setTemplates((data || []) as ChecklistTemplateWithEquipment[]))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {templates.length} template{templates.length !== 1 ? "s" : ""} across all equipment
        </p>
        <Button size="sm" onClick={openNew}>
          <Plus className="mr-1 h-4 w-4" /> Add Template
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit" : "Add"} Checklist Template</DialogTitle>
          </DialogHeader>

          <form action={saveChecklistTemplate} onSubmit={() => setTimeout(refresh, 500)} className="space-y-4">
            <input type="hidden" name="template_id" value={editId || ""} />
            <input type="hidden" name="equipment_id" value={selEquipment} />
            <input type="hidden" name="items" value={buildItemsJson()} />

            <div>
              <Label htmlFor="tmpl-equipment">Equipment *</Label>
              <select
                id="tmpl-equipment"
                value={selEquipment}
                onChange={(e) => setSelEquipment(e.target.value)}
                className="h-9 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none"
                required
              >
                <option value="">Select equipment...</option>
                {equipment.map((eq) => (
                  <option key={eq.id} value={eq.id}>{eq.tag_number} — {eq.name}</option>
                ))}
              </select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="tmpl-name">Name *</Label>
                <Input
                  id="tmpl-name"
                  name="name"
                  value={tmplName}
                  onChange={(e) => setTmplName(e.target.value)}
                  placeholder="Daily Safety Check"
                  required
                />
              </div>
              <div>
                <Label htmlFor="tmpl-freq">Frequency</Label>
                <select
                  id="tmpl-freq"
                  name="frequency"
                  value={tmplFreq}
                  onChange={(e) => setTmplFreq(e.target.value)}
                  className="h-9 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label>Checklist Tasks</Label>
                <button type="button" onClick={addTask} className="flex items-center gap-1 text-xs font-medium text-primary">
                  <Plus className="h-3 w-3" /> Add task
                </button>
              </div>
              <div className="space-y-2">
                {tasks.map((task) => (
                  <div key={task.id} className="rounded-lg border bg-muted p-2">
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
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">Options:</span>
                        <Input
                          value={(task.options || []).join(", ")}
                          onChange={(e) => updateTask(task.id, "options", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
                          placeholder="Good, Fair, Poor"
                          className="h-7 flex-1 text-xs"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" size="sm" className="bg-primary hover:bg-primary/90" disabled={!tmplName.trim() || !selEquipment}>
                {editId ? "Update" : "Create"} Template
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {templates.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No checklist templates yet.</p>
      ) : (
        <div className="rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Equipment</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Items</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((tpl) => (
                <TableRow key={tpl.id}>
                  <TableCell className="text-sm">
                    {(tpl as ChecklistTemplateWithEquipment).equipment?.name || "—"}<br />
                    <span className="text-xs text-muted-foreground">{(tpl as ChecklistTemplateWithEquipment).equipment?.tag_number}</span>
                  </TableCell>
                  <TableCell className="font-medium text-sm">{tpl.name}</TableCell>
                  <TableCell className="text-sm capitalize">{tpl.frequency}</TableCell>
                  <TableCell className="text-sm">{tpl.items.length}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(tpl)} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-primary">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <form action={deleteChecklistTemplate.bind(null, tpl.id, tpl.equipment_id)}>
                        <button type="submit" className="rounded p-1 text-muted-foreground hover:bg-danger-subtle hover:text-danger-strong">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </form>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
