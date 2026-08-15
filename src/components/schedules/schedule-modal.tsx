"use client"

import { useState, useEffect } from "react"
import { X, Plus, Trash2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { createPMSchedule } from "@/lib/actions/pm-schedules"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import type { Equipment } from "@/lib/types"

type FieldType = "checkbox" | "number" | "combobox"

interface TaskItem {
  id: string
  text: string
  type: FieldType
  required: boolean
}

interface Props {
  open: boolean
  onClose: () => void
  onSave: (data: {
    name: string
    frequency: string
    firstDueDate: string
    tasks: TaskItem[]
  }) => void
}

function getFrequencyDays(freq: string): number {
  switch (freq) {
    case "daily": return 1
    case "weekly": return 7
    case "biweekly": return 14
    case "monthly": return 30
    case "quarterly": return 90
    default: return 7
  }
}

function getFrequencyLabel(freq: string): string {
  switch (freq) {
    case "daily": return "daily"
    case "weekly": return "weekly"
    case "biweekly": return "bi-weekly"
    case "monthly": return "monthly"
    case "quarterly": return "quarterly"
    default: return "weekly"
  }
}

let taskCounter = 0

export function ScheduleModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const supabase = createClient()
  const [name, setName] = useState("")
  const [frequency, setFrequency] = useState("weekly")
  const [firstDueDate, setFirstDueDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [equipmentId, setEquipmentId] = useState("")
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [tasks, setTasks] = useState<TaskItem[]>([
    { id: `${++taskCounter}`, text: "", type: "checkbox", required: true },
  ])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase
      .from("equipment")
      .select("*")
      .eq("status", "active")
      .order("name")
      .then(({ data }) => setEquipment((data || []) as Equipment[]))
  }, [])

  if (!open) return null

  const addTask = () => {
    setTasks([...tasks, { id: `${++taskCounter}`, text: "", type: "checkbox", required: false }])
  }

  const removeTask = (id: string) => {
    if (tasks.length <= 1) return
    setTasks(tasks.filter((t) => t.id !== id))
  }

  const updateTask = (id: string, field: keyof TaskItem, value: string | boolean) => {
    setTasks(tasks.map((t) => (t.id === id ? { ...t, [field]: value } : t)))
  }

  const handleSave = async () => {
    if (!name.trim() || !equipmentId) return
    setSaving(true)

    const validTasks = tasks.filter((t) => t.text.trim().length > 0)
    const checklist = validTasks.map((t, i) => ({
      id: `check-${i}`,
      text: t.text.trim(),
      completed: false,
      type: t.type,
      required: t.required,
    }))

    const form = new FormData()
    form.set("equipment_id", equipmentId)
    form.set("frequency_days", String(getFrequencyDays(frequency)))
    form.set("calendar_interval_days", String(getFrequencyDays(frequency)))
    form.set("first_due_date", firstDueDate)
    form.set("trigger_type", "calendar")
    form.set("risk_modifier", "1")
    form.set("grace_period_days", "2")
    form.set("escalation_assignee_after_days", "0")
    form.set("escalation_admin_after_days", "2")
    form.set("escalation_department_after_days", "5")
    form.set("description", name.trim())
    form.set("checklist", JSON.stringify(checklist))
    form.set("active", "true")
    form.set("reason", "Create PM schedule")

    try {
      await createPMSchedule(form)
    } finally {
      setSaving(false)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-[10vh]">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-foreground">Add maintenance schedule</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Define a recurring task list. The next-due date advances automatically each time you record a log.
            </p>
          </div>
          <button onClick={onClose} className="ml-4 shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-muted-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-5 px-6 py-5">
          <div>
            <Label htmlFor="sch-name">Name</Label>
            <Input
              id="sch-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Daily startup check"
            />
          </div>

          <div>
            <Label htmlFor="sch-equipment">Equipment *</Label>
            <select
              id="sch-equipment"
              value={equipmentId}
              onChange={(e) => setEquipmentId(e.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-[-1px]"
            >
              <option value="">Select equipment...</option>
              {equipment.map((eq) => (
                <option key={eq.id} value={eq.id}>{eq.tag_number} — {eq.name}</option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="sch-frequency">Frequency</Label>
            <select
              id="sch-frequency"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-[-1px]"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Bi-Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
            </select>
          </div>

          <div>
            <Label htmlFor="sch-due">First due date</Label>
            <Input
              id="sch-due"
              type="date"
              value={firstDueDate}
              onChange={(e) => setFirstDueDate(e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              When this schedule is first due. After you record maintenance, the next-due date advances by one {getFrequencyLabel(frequency)} interval automatically.
            </p>
          </div>

          {/* Checklist Tasks */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Checklist tasks</h3>
              <button
                type="button"
                onClick={addTask}
                className="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80"
              >
                <Plus className="h-4 w-4" />
                Add task
              </button>
            </div>

            <div className="space-y-2">
              {tasks.map((task) => (
                <div key={task.id} className="flex items-center gap-2 rounded-lg border bg-muted p-2">
                  <Input
                    value={task.text}
                    onChange={(e) => updateTask(task.id, "text", e.target.value)}
                    placeholder={`Task ${task.id}`}
                    className={`h-9 flex-1 text-sm ${task.text ? "border-info ring-1 ring-info/30" : ""}`}
                  />

                  <select
                    value={task.type}
                    onChange={(e) => updateTask(task.id, "type", e.target.value)}
                    className="h-9 w-28 rounded-lg border border-input bg-card px-2 text-sm text-foreground outline-none"
                  >
                    <option value="checkbox">Checkbox</option>
                    <option value="number">Number</option>
                    <option value="combobox">Combobox</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => updateTask(task.id, "required", !task.required)}
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                      task.required
                        ? "bg-info-subtle text-primary"
                        : "bg-neutral-subtle text-muted-foreground"
                    }`}
                    title={task.required ? "Required" : "Optional"}
                  >
                    {task.required ? (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      "−"
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => removeTask(task.id)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-danger-subtle hover:text-danger-strong"
                    disabled={tasks.length <= 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t px-6 py-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="bg-primary text-white hover:bg-primary/90"
          >
            {saving ? "Saving..." : "Save schedule"}
          </Button>
        </div>
      </div>
    </div>
  )
}
