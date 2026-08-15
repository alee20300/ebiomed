import { z } from "zod"

export const checklistItemSchema = z.object({
  id: z.string(),
  text: z.string(),
  completed: z.boolean().default(false),
})

export const pmScheduleSchema = z.object({
  equipment_id: z.string().uuid("Valid equipment is required"),
  frequency_days: z.coerce.number().int().min(1, "Must be at least 1 day"),
  first_due_date: z.string().optional(),
  trigger_type: z.enum(["calendar", "run_hours", "cycles", "calendar_or_usage", "calendar_and_usage"]).default("calendar"),
  calendar_interval_days: z.coerce.number().int().min(1).optional(),
  meter_interval: z.coerce.number().positive().optional(),
  cycle_interval: z.coerce.number().int().positive().optional(),
  risk_modifier: z.coerce.number().positive().default(1),
  grace_period_days: z.coerce.number().int().min(0).default(0),
  escalation_assignee_after_days: z.coerce.number().int().min(0).default(0),
  escalation_admin_after_days: z.coerce.number().int().min(0).default(2),
  escalation_department_after_days: z.coerce.number().int().min(0).default(5),
  description: z.string().optional(),
  checklist: z.union([z.array(checklistItemSchema), z.string()]).transform((val) => {
    if (Array.isArray(val)) return val
    return val
      .split("\n")
      .map((text, index) => ({
        id: `check-${index}`,
        text: text.trim(),
        completed: false,
      }))
      .filter((item) => item.text.length > 0)
  }).default([]),
  assigned_to: z.string().uuid().optional().or(z.literal("")),
  active: z.union([z.boolean(), z.string()]).transform((val) => {
    if (typeof val === "boolean") return val
    return val === "true"
  }).default(true),
  reason: z.string().min(5, "Reason for change is required").max(500, "Reason too long"),
}).superRefine((data, ctx) => {
  if ((data.trigger_type === "calendar" || data.trigger_type === "calendar_or_usage" || data.trigger_type === "calendar_and_usage") && !data.calendar_interval_days && !data.frequency_days) {
    ctx.addIssue({ code: "custom", path: ["calendar_interval_days"], message: "Calendar interval is required" })
  }
  if (data.trigger_type === "run_hours" && !data.meter_interval) {
    ctx.addIssue({ code: "custom", path: ["meter_interval"], message: "Meter interval is required for run-hour PMs" })
  }
  if (data.trigger_type === "cycles" && !data.cycle_interval) {
    ctx.addIssue({ code: "custom", path: ["cycle_interval"], message: "Cycle interval is required for cycle PMs" })
  }
  if ((data.trigger_type === "calendar_or_usage" || data.trigger_type === "calendar_and_usage") && !data.meter_interval && !data.cycle_interval) {
    ctx.addIssue({ code: "custom", path: ["meter_interval"], message: "At least one usage interval is required" })
  }
  if (data.escalation_assignee_after_days > data.escalation_admin_after_days) {
    ctx.addIssue({ code: "custom", path: ["escalation_assignee_after_days"], message: "Assignee escalation must happen before admin escalation" })
  }
  if (data.escalation_admin_after_days > data.escalation_department_after_days) {
    ctx.addIssue({ code: "custom", path: ["escalation_admin_after_days"], message: "Admin escalation must happen before department escalation" })
  }
})

export const pmOccurrenceSkipSchema = z.object({
  reason: z.string().trim().min(5, "Skip reason must be at least 5 characters").max(500, "Skip reason must be under 500 characters"),
})

export type PMScheduleFormData = z.infer<typeof pmScheduleSchema>
export type ChecklistItem = z.infer<typeof checklistItemSchema>
