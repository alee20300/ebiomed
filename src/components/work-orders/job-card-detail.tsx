"use client"

import { useState } from "react"
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

  return (
    <div className="rounded-lg border bg-white">
      <div className="flex items-center justify-between border-b p-4">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-semibold">Job Card</h4>
            {isInProgress ? (
              <Badge className="bg-blue-100 text-blue-700">In Progress</Badge>
            ) : (
              <Badge className="bg-green-100 text-green-700">Completed</Badge>
            )}
          </div>
          <p className="text-sm text-gray-500">
            {jobCard.technician?.full_name || "Unknown"} · Started{" "}
            {new Date(jobCard.started_at).toLocaleString()}
            {jobCard.completed_at && ` · Completed ${new Date(jobCard.completed_at).toLocaleString()}`}
          </p>
        </div>
      </div>

      {/* Time Entries */}
      <div className="border-b p-4">
        <h5 className="mb-2 text-xs font-semibold uppercase text-gray-500">Time Log</h5>
        {(jobCard.entries?.length || 0) > 0 ? (
          <div className="mb-3 space-y-1">
            {jobCard.entries?.map((entry) => (
              <div key={entry.id} className="flex justify-between text-sm">
                <span>{entry.description}</span>
                <span className="text-gray-500">
                  {new Date(entry.started_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} –{" "}
                  {new Date(entry.ended_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} ·{" "}
                  {entry.duration_minutes}m
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mb-3 text-sm text-gray-400">No time entries yet</p>
        )}
        {isInProgress && <TimeEntryForm jobCardId={jobCard.id} />}
        {totalMinutes > 0 && (
          <p className="mt-2 text-sm font-medium">Total: {totalMinutes}m</p>
        )}
      </div>

      {/* Parts Used */}
      <div className="border-b p-4">
        <h5 className="mb-2 text-xs font-semibold uppercase text-gray-500">Parts Used</h5>
        {(jobCard.parts?.length || 0) > 0 ? (
          <div className="space-y-1">
            {jobCard.parts?.map((p) => (
              <div key={p.id} className="flex justify-between text-sm">
                <span>{p.part?.name || "Unknown part"}</span>
                <span className="text-gray-500">Qty: {p.quantity_used}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">No parts used</p>
        )}
      </div>

      {/* Expenses (only if toggle ON) */}
      {expenseEnabled && (
        <div className="border-b p-4">
          <h5 className="mb-2 text-xs font-semibold uppercase text-gray-500">Expenses</h5>
          {(jobCard.expenses?.length || 0) > 0 ? (
            <div className="mb-3 space-y-1">
              {jobCard.expenses?.map((exp) => (
                <div key={exp.id} className="flex justify-between text-sm">
                  <div>
                    <span>{CATEGORY_LABELS[exp.category] || exp.category}: </span>
                    <span>{exp.description}</span>
                  </div>
                  <span className="text-gray-500">${Number(exp.amount).toFixed(2)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mb-3 text-sm text-gray-400">No expenses</p>
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
          <h5 className="mb-1 text-xs font-semibold uppercase text-gray-500">Work Done</h5>
          <p className="text-sm">{jobCard.summary}</p>
          {jobCard.unresolved_issues && (
            <>
              <h5 className="mb-1 mt-3 text-xs font-semibold uppercase text-red-600">Unresolved Issues</h5>
              <p className="text-sm text-red-700">{jobCard.unresolved_issues}</p>
            </>
          )}
        </div>
      )}

      {/* Close button (in progress only) */}
      {isInProgress && (
        <div className="p-4">
          {!closeOpen ? (
            <Button onClick={() => setCloseOpen(true)} variant="default">
              Complete Job Card
            </Button>
          ) : (
            <form action={async (fd) => { await completeJobCard(jobCard.id, fd) }} className="space-y-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
              <div>
                <Label htmlFor="summary">Summary of work done *</Label>
                <Textarea id="summary" name="summary" required minLength={10} className="mt-1" placeholder="Describe what was done..." />
              </div>
              <div>
                <Label htmlFor="unresolved_issues">Unresolved issues (optional)</Label>
                <Textarea id="unresolved_issues" name="unresolved_issues" className="mt-1" placeholder="What still needs attention?" />
              </div>
              <div className="flex gap-2">
                <Button type="submit">Complete Job Card</Button>
                <Button type="button" variant="ghost" onClick={() => setCloseOpen(false)}>Cancel</Button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
