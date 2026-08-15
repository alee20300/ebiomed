"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { createPMSchedule } from "@/lib/actions/pm-schedules"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Plus, Trash2, AlertCircle, ArrowLeft } from "lucide-react"
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
  const [triggerType, setTriggerType] = useState("calendar")
  const [meterInterval, setMeterInterval] = useState("")
  const [cycleInterval, setCycleInterval] = useState("")
  const [riskModifier, setRiskModifier] = useState("1")
  const [gracePeriodDays, setGracePeriodDays] = useState("2")
  const [assigneeEscalationDays, setAssigneeEscalationDays] = useState("0")
  const [adminEscalationDays, setAdminEscalationDays] = useState("2")
  const [departmentEscalationDays, setDepartmentEscalationDays] = useState("5")
  const [firstDueDate, setFirstDueDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [equipmentId, setEquipmentId] = useState("")
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [tasks, setTasks] = useState<TaskDraft[]>([
    { id: `${++taskId}`, text: "", type: "checkbox", required: true, options: [] },
  ])
  const [saving, setSaving] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])

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

  const updateTask = <K extends keyof TaskDraft>(id: string, field: K, value: TaskDraft[K]) => {
    setTasks(tasks.map((t) => (t.id === id ? { ...t, [field]: value } : t)))
  }

  const frequencyDaysMap: Record<string, number> = {
    daily: 1, weekly: 7, biweekly: 14, monthly: 30, quarterly: 90,
  }

  const handleSave = async () => {
    const validTasks = tasks.filter((t) => t.text.trim())
    const errors = [
      !name.trim() ? "Schedule name is required." : "",
      !equipmentId ? "Equipment is required." : "",
      validTasks.length === 0 ? "At least one checklist task is required." : "",
      (triggerType === "run_hours" || triggerType === "calendar_or_usage" || triggerType === "calendar_and_usage") && !meterInterval ? "Meter interval is required for run-hour triggers." : "",
      (triggerType === "cycles" || triggerType === "calendar_or_usage" || triggerType === "calendar_and_usage") && !cycleInterval ? "Cycle interval is required for cycle triggers." : "",
    ].filter(Boolean) as string[]
    setValidationErrors(errors)
    if (errors.length > 0) return

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
    form.set("calendar_interval_days", String(frequencyDaysMap[frequency] || 30))
    form.set("first_due_date", firstDueDate)
    form.set("trigger_type", triggerType)
    if (meterInterval) form.set("meter_interval", meterInterval)
    if (cycleInterval) form.set("cycle_interval", cycleInterval)
    form.set("risk_modifier", riskModifier)
    form.set("grace_period_days", gracePeriodDays)
    form.set("escalation_assignee_after_days", assigneeEscalationDays)
    form.set("escalation_admin_after_days", adminEscalationDays)
    form.set("escalation_department_after_days", departmentEscalationDays)
    form.set("description", name.trim())
    form.set("checklist", JSON.stringify(checklist))
    form.set("active", "true")
    form.set("reason", "Create advanced PM schedule")

    setSaving(true)
    await createPMSchedule(form)
  }

  return (
    <div className="mx-auto w-full max-w-lg min-w-0">
      <div className="mb-4">
        <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
      </div>

      <div className="min-w-0 rounded-xl bg-white shadow-lg">
        {/* Header */}
        <div className="border-b px-6 py-4">
          <h2 className="text-lg font-bold text-foreground">Add maintenance schedule</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
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
        {validationErrors.length > 0 && (
          <div className="mx-6 mt-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{validationErrors.join(" ")}</AlertDescription>
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
              className="h-9 w-full min-w-0 rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none"
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
            <Label htmlFor="pm-trigger-type">Trigger type</Label>
            <select
              id="pm-trigger-type"
              value={triggerType}
              onChange={(e) => setTriggerType(e.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none"
            >
              <option value="calendar">Calendar</option>
              <option value="run_hours">Run hours</option>
              <option value="cycles">Cycles</option>
              <option value="calendar_or_usage">Calendar or usage</option>
              <option value="calendar_and_usage">Calendar and usage</option>
            </select>
          </div>

          {(triggerType === "run_hours" || triggerType === "calendar_or_usage" || triggerType === "calendar_and_usage") && (
            <div>
              <Label htmlFor="pm-meter-interval">Meter interval</Label>
              <Input
                id="pm-meter-interval"
                type="number"
                min={1}
                step="0.1"
                value={meterInterval}
                onChange={(e) => setMeterInterval(e.target.value)}
                placeholder="Run hours before PM"
              />
            </div>
          )}

          {(triggerType === "cycles" || triggerType === "calendar_or_usage" || triggerType === "calendar_and_usage") && (
            <div>
              <Label htmlFor="pm-cycle-interval">Cycle interval</Label>
              <Input
                id="pm-cycle-interval"
                type="number"
                min={1}
                step={1}
                value={cycleInterval}
                onChange={(e) => setCycleInterval(e.target.value)}
                placeholder="Cycles before PM"
              />
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="pm-risk-modifier">Risk modifier</Label>
              <Input
                id="pm-risk-modifier"
                type="number"
                min="0.1"
                step="0.1"
                value={riskModifier}
                onChange={(e) => setRiskModifier(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="pm-grace-period">Grace period days</Label>
              <Input
                id="pm-grace-period"
                type="number"
                min={0}
                step={1}
                value={gracePeriodDays}
                onChange={(e) => setGracePeriodDays(e.target.value)}
              />
            </div>
          </div>

          <div className="rounded-lg border bg-muted p-3">
            <h3 className="text-sm font-semibold text-foreground">Escalation policy</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div>
                <Label htmlFor="pm-assignee-escalation">Assignee after days</Label>
                <Input
                  id="pm-assignee-escalation"
                  type="number"
                  min={0}
                  step={1}
                  value={assigneeEscalationDays}
                  onChange={(e) => setAssigneeEscalationDays(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="pm-admin-escalation">Admin after days</Label>
                <Input
                  id="pm-admin-escalation"
                  type="number"
                  min={0}
                  step={1}
                  value={adminEscalationDays}
                  onChange={(e) => setAdminEscalationDays(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="pm-department-escalation">Department after days</Label>
                <Input
                  id="pm-department-escalation"
                  type="number"
                  min={0}
                  step={1}
                  value={departmentEscalationDays}
                  onChange={(e) => setDepartmentEscalationDays(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="pm-due">First due date</Label>
            <Input
              id="pm-due"
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
              <button type="button" onClick={addTask} className="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80">
                <Plus className="h-4 w-4" /> Add task
              </button>
            </div>

            <div className="space-y-2">
              {tasks.map((task) => (
                <div key={task.id} className="rounded-lg border bg-muted p-2">
                  <div className="mb-1 flex items-center gap-2">
                    <Input
                      aria-label={`Task ${task.id} text`}
                      value={task.text}
                      onChange={(e) => updateTask(task.id, "text", e.target.value)}
                      placeholder={`Task ${task.id}`}
                      className={`h-9 min-w-0 flex-1 text-sm ${task.text ? "border-info ring-1 ring-info/30" : ""}`}
                    />
                    <select
                      aria-label={`Task ${task.id} type`}
                      value={task.type}
                      onChange={(e) => updateTask(task.id, "type", e.target.value as FieldType)}
                      className="h-9 w-24 shrink-0 rounded-lg border border-input bg-card px-2 text-sm outline-none sm:w-28"
                    >
                      <option value="checkbox">Checkbox</option>
                      <option value="number">Number</option>
                      <option value="combobox">Combobox</option>
                    </select>
                    <button
                      type="button"
                      aria-label={task.required ? `Mark task ${task.id} optional` : `Mark task ${task.id} required`}
                      onClick={() => updateTask(task.id, "required", !task.required)}
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-medium ${
                        task.required ? "bg-info-subtle text-primary" : "bg-neutral-subtle text-muted-foreground"
                      }`}
                    >
                      {task.required ? "✓" : "−"}
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove task ${task.id}`}
                      onClick={() => removeTask(task.id)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-danger-subtle hover:text-danger-strong"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {task.type === "combobox" && (
                    <div className="flex min-w-0 items-center gap-1">
                      <span className="text-xs text-muted-foreground">Options:</span>
                      <Input
                        aria-label={`Task ${task.id} combobox options`}
                        value={(task.options || []).join(", ")}
                        onChange={(e) =>
                          updateTask(task.id, "options", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))
                        }
                        placeholder="Good, Fair, Poor"
                        className="h-7 min-w-0 flex-1 text-xs"
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
            className="bg-primary text-white hover:bg-primary/90"
          >
            {saving ? "Saving..." : "Save schedule"}
          </Button>
        </div>
      </div>
    </div>
  )
}
