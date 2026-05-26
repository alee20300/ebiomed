"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { createPMSchedule } from "@/lib/actions/pm-schedules"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { X, Plus, Trash2, AlertCircle, ArrowLeft } from "lucide-react"
import type { Equipment } from "@/lib/types"

type FieldType = "checkbox" | "number" | "combobox"

interface TaskDraft {
  id: string
  text: string
  type: FieldType
  required: boolean
  options: string[]
}

let taskId = 0

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

export function PMScheduleForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const error = searchParams.get("error")
  const supabase = createClient()

  const [name, setName] = useState("")
  const [frequency, setFrequency] = useState("monthly")
  const [firstDueDate, setFirstDueDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [equipmentId, setEquipmentId] = useState("")
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [tasks, setTasks] = useState<TaskDraft[]>([
    { id: `${++taskId}`, text: "", type: "checkbox", required: true, options: [] },
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

  const addTask = () => {
    setTasks([...tasks, { id: `${++taskId}`, text: "", type: "checkbox", required: false, options: [] }])
  }

  const removeTask = (id: string) => {
    if (tasks.length <= 1) return
    setTasks(tasks.filter((t) => t.id !== id))
  }

  const updateTask = (id: string, field: string, value: any) => {
    setTasks(tasks.map((t) => (t.id === id ? { ...t, [field]: value } : t)))
  }

  const frequencyDaysMap: Record<string, number> = {
    daily: 1, weekly: 7, biweekly: 14, monthly: 30, quarterly: 90,
  }

  const handleSave = async () => {
    if (!name.trim() || !equipmentId) return

    const validTasks = tasks.filter((t) => t.text.trim())
    const checklist = validTasks.map((t, i) => ({
      id: `check-${i}`,
      text: t.text.trim(),
      completed: false,
      type: t.type,
      required: t.required,
      options: t.options.length > 0 ? t.options : undefined,
    }))

    const form = new FormData()
    form.set("equipment_id", equipmentId)
    form.set("frequency_days", String(frequencyDaysMap[frequency] || 30))
    form.set("description", name.trim())
    form.set("checklist", JSON.stringify(checklist))
    form.set("active", "true")

    setSaving(true)
    await createPMSchedule(form)
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-4">
        <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-gray-500 hover:text-primary">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
      </div>

      <div className="rounded-xl bg-white shadow-lg">
        {/* Header */}
        <div className="border-b px-6 py-4">
          <h2 className="text-lg font-bold text-gray-900">Add maintenance schedule</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Define a recurring task list. The next-due date advances automatically each time you record a log.
          </p>
        </div>

        {error && (
          <div className="mx-6 mt-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        )}

        <div className="space-y-5 px-6 py-5">
          <div>
            <Label htmlFor="pm-name">Name</Label>
            <Input
              id="pm-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Quarterly inspection and calibration"
            />
          </div>

          <div>
            <Label htmlFor="pm-equipment">Equipment *</Label>
            <select
              id="pm-equipment"
              value={equipmentId}
              onChange={(e) => setEquipmentId(e.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none"
            >
              <option value="">Select equipment...</option>
              {equipment.map((eq) => (
                <option key={eq.id} value={eq.id}>{eq.tag_number} — {eq.name}</option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="pm-freq">Frequency</Label>
            <select
              id="pm-freq"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Bi-Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
            </select>
          </div>

          <div>
            <Label htmlFor="pm-due">First due date</Label>
            <Input
              id="pm-due"
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
              <button type="button" onClick={addTask} className="flex items-center gap-1 text-sm font-medium text-teal-600 hover:text-teal-700">
                <Plus className="h-4 w-4" /> Add task
              </button>
            </div>

            <div className="space-y-2">
              {tasks.map((task) => (
                <div key={task.id} className="rounded-lg border bg-gray-50 p-2">
                  <div className="mb-1 flex items-center gap-2">
                    <Input
                      value={task.text}
                      onChange={(e) => updateTask(task.id, "text", e.target.value)}
                      placeholder={`Task ${task.id}`}
                      className={`h-9 flex-1 text-sm ${task.text ? "border-blue-400 ring-1 ring-blue-200" : ""}`}
                    />
                    <select
                      value={task.type}
                      onChange={(e) => updateTask(task.id, "type", e.target.value)}
                      className="h-9 w-28 rounded-lg border border-input bg-card px-2 text-sm outline-none"
                    >
                      <option value="checkbox">Checkbox</option>
                      <option value="number">Number</option>
                      <option value="combobox">Combobox</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => updateTask(task.id, "required", !task.required)}
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-medium ${
                        task.required ? "bg-blue-50 text-blue-600" : "bg-gray-200 text-gray-400"
                      }`}
                    >
                      {task.required ? "✓" : "−"}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeTask(task.id)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {task.type === "combobox" && (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-400">Options:</span>
                      <Input
                        value={(task.options || []).join(", ")}
                        onChange={(e) =>
                          updateTask(task.id, "options", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))
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
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t px-6 py-4">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!name.trim() || !equipmentId || saving}
            className="bg-teal-600 text-white hover:bg-teal-700"
          >
            {saving ? "Saving..." : "Save schedule"}
          </Button>
        </div>
      </div>
    </div>
  )
}
