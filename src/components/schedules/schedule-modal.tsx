"use client"

import { useState } from "react"
import { X, Plus, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

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

export function ScheduleModal({ open, onClose, onSave }: Props) {
  const [name, setName] = useState("")
  const [frequency, setFrequency] = useState("weekly")
  const [firstDueDate, setFirstDueDate] = useState(() => {
    const d = new Date()
    return d.toISOString().slice(0, 10)
  })
  const [tasks, setTasks] = useState<TaskItem[]>([
    { id: `${++taskCounter}`, text: "", type: "checkbox", required: true },
  ])
  const [saving, setSaving] = useState(false)

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
    if (!name.trim()) return
    setSaving(true)
    const validTasks = tasks.filter((t) => t.text.trim().length > 0)
    onSave({ name: name.trim(), frequency, firstDueDate, tasks: validTasks })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-[10vh]">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Add maintenance schedule</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              Define a recurring task list. The next-due date advances automatically each time you record a log.
            </p>
          </div>
          <button onClick={onClose} className="ml-4 shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
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
            <p className="mt-1 text-xs text-gray-500">
              When this schedule is first due. After you record maintenance, the next-due date advances by one {getFrequencyLabel(frequency)} interval automatically.
            </p>
          </div>

          {/* Checklist Tasks */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">Checklist tasks</h3>
              <button
                type="button"
                onClick={addTask}
                className="flex items-center gap-1 text-sm font-medium text-teal-600 hover:text-teal-700"
              >
                <Plus className="h-4 w-4" />
                Add task
              </button>
            </div>

            <div className="space-y-2">
              {tasks.map((task) => (
                <div key={task.id} className="flex items-center gap-2 rounded-lg border bg-gray-50 p-2">
                  <Input
                    value={task.text}
                    onChange={(e) => updateTask(task.id, "text", e.target.value)}
                    placeholder={`Task ${task.id}`}
                    className={`h-9 flex-1 text-sm ${task.text ? "border-blue-400 ring-1 ring-blue-200" : ""}`}
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
                        ? "bg-blue-50 text-blue-600"
                        : "bg-gray-200 text-gray-400"
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
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500"
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
            className="bg-teal-600 text-white hover:bg-teal-700"
          >
            {saving ? "Saving..." : "Save schedule"}
          </Button>
        </div>
      </div>
    </div>
  )
}
