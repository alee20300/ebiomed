"use client"

import { useState } from "react"
import { Clock, Package, ReceiptText } from "lucide-react"
import { completeJobCard } from "@/lib/actions/job-cards"
import { TimeEntryForm } from "@/components/work-orders/time-entry-form"
import { ExpenseForm } from "@/components/work-orders/expense-form"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import type { JobCard } from "@/lib/types"

const CATEGORY_LABELS: Record<string, string> = {
  food: "Food",
  ticket: "Ticket",
  accommodation: "Accommodation",
}

export function JobCardDetail({
  jobCard,
  expenseEnabled,
}: {
  jobCard: JobCard
  expenseEnabled: boolean
}) {
  const [closeOpen, setCloseOpen] = useState(false)
  const isInProgress = jobCard.status === "in_progress"

  const totalMinutes = jobCard.entries?.reduce((sum, e) => sum + e.duration_minutes, 0) || 0
  const totalExpenses = jobCard.expenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0
  const totalParts = jobCard.parts?.reduce((sum, p) => sum + p.quantity_used, 0) || 0

  return (
    <div className="rounded-lg border bg-white">
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-semibold">Job Card</h4>
            {isInProgress ? (
              <Badge className="bg-info-subtle text-primary">In Progress</Badge>
            ) : (
              <Badge className="bg-success-subtle text-success-strong">Completed</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {jobCard.technician?.full_name || "Unknown"} · Started{" "}
            {new Date(jobCard.started_at).toLocaleString()}
            {jobCard.completed_at && ` · Completed ${new Date(jobCard.completed_at).toLocaleString()}`}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-lg border bg-muted/20 px-2 py-2">
            <Clock className="mx-auto mb-1 h-4 w-4 text-muted-foreground" />
            <span className="font-semibold">{totalMinutes}m</span>
          </div>
          <div className="rounded-lg border bg-muted/20 px-2 py-2">
            <Package className="mx-auto mb-1 h-4 w-4 text-muted-foreground" />
            <span className="font-semibold">{totalParts}</span>
          </div>
          {expenseEnabled && (
            <div className="rounded-lg border bg-muted/20 px-2 py-2">
              <ReceiptText className="mx-auto mb-1 h-4 w-4 text-muted-foreground" />
              <span className="font-semibold">${totalExpenses.toFixed(0)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Time Entries */}
      <div className="border-b p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h5 className="text-xs font-semibold uppercase text-muted-foreground">Time Log</h5>
          {totalMinutes > 0 && (
            <span className="rounded-full bg-info-subtle px-2 py-1 text-xs font-medium text-primary">
              {totalMinutes}m total
            </span>
          )}
        </div>
        {(jobCard.entries?.length || 0) > 0 ? (
          <div className="mb-3 space-y-2">
            {jobCard.entries?.map((entry) => (
              <div key={entry.id} className="rounded-lg border bg-muted/20 p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <span className="font-medium">{entry.description}</span>
                  <span className="shrink-0 rounded-full bg-white px-2 py-1 text-xs font-semibold text-foreground">
                    {entry.duration_minutes}m
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(entry.started_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} –{" "}
                  {new Date(entry.ended_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mb-3 text-sm text-muted-foreground">No time entries yet</p>
        )}
        {isInProgress && <TimeEntryForm jobCardId={jobCard.id} workOrderId={jobCard.work_order_id} />}
      </div>

      {/* Parts Used */}
      <div className="border-b p-4">
        <h5 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Parts Used</h5>
        {(jobCard.parts?.length || 0) > 0 ? (
          <div className="space-y-2">
            {jobCard.parts?.map((p) => (
              <div key={p.id} className="flex justify-between gap-3 rounded-lg border bg-muted/20 p-3 text-sm">
                <span>{p.part?.name || "Unknown part"}</span>
                <span className="shrink-0 text-muted-foreground">Qty: {p.quantity_used}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No parts used</p>
        )}
      </div>

      {/* Expenses (only if toggle ON) */}
      {expenseEnabled && (
        <div className="border-b p-4">
          <h5 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Expenses</h5>
          {(jobCard.expenses?.length || 0) > 0 ? (
            <div className="mb-3 space-y-2">
              {jobCard.expenses?.map((exp) => (
                <div key={exp.id} className="flex justify-between gap-3 rounded-lg border bg-muted/20 p-3 text-sm">
                  <div>
                    <span>{CATEGORY_LABELS[exp.category] || exp.category}: </span>
                    <span>{exp.description}</span>
                  </div>
                  <span className="shrink-0 text-muted-foreground">${Number(exp.amount).toFixed(2)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mb-3 text-sm text-muted-foreground">No expenses</p>
          )}
          {isInProgress && <ExpenseForm jobCardId={jobCard.id} />}
          {totalExpenses > 0 && (
            <p className="mt-2 text-sm font-medium">Total: ${totalExpenses.toFixed(2)}</p>
          )}
        </div>
      )}

      {/* Summary (completed only) */}
      {jobCard.status === "completed" && jobCard.summary && (
        <div className="border-b p-4">
          <h5 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Work Done</h5>
          <p className="text-sm">{jobCard.summary}</p>
          {jobCard.unresolved_issues && (
            <>
              <h5 className="mb-1 mt-3 text-xs font-semibold uppercase text-danger-strong">Unresolved Issues</h5>
              <p className="text-sm text-danger-strong">{jobCard.unresolved_issues}</p>
            </>
          )}
        </div>
      )}

      {/* Close button (in progress only) */}
      {isInProgress && (
        <div className="p-4">
          {!closeOpen ? (
            <Button onClick={() => setCloseOpen(true)} variant="default" className="w-full sm:w-auto">
              Complete Job Card
            </Button>
          ) : (
            <form action={async (fd) => { await completeJobCard(jobCard.id, fd) }} className="space-y-3 rounded-lg border border-warning bg-warning-subtle p-4">
              <div>
                <Label htmlFor="summary">Summary of work done *</Label>
                <Textarea id="summary" name="summary" required minLength={10} className="mt-1" placeholder="Describe what was done..." />
              </div>
              <div>
                <Label htmlFor="unresolved_issues">Unresolved issues (optional)</Label>
                <Textarea id="unresolved_issues" name="unresolved_issues" className="mt-1" placeholder="What still needs attention?" />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="submit" className="w-full sm:w-auto">Complete Job Card</Button>
                <Button type="button" variant="ghost" onClick={() => setCloseOpen(false)} className="w-full sm:w-auto">Cancel</Button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
