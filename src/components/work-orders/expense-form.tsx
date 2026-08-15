"use client"

import { useState } from "react"
import { addJobCardExpense } from "@/lib/actions/expenses"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function ExpenseForm({ jobCardId }: { jobCardId: string }) {
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        + Add Expense
      </Button>
    )
  }

  return (
    <form action={async (fd) => { await addJobCardExpense(jobCardId, fd); setOpen(false) }} className="space-y-3 rounded-lg border p-3">
      <div>
        <Label htmlFor="category">Category</Label>
        <Select name="category" required>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="food">Food</SelectItem>
            <SelectItem value="ticket">Ticket</SelectItem>
            <SelectItem value="accommodation">Accommodation</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="amount">Amount</Label>
        <Input id="amount" name="amount" type="number" step="0.01" min="0.01" required className="mt-1" />
      </div>
      <div>
        <Label htmlFor="description">Description</Label>
        <Input id="description" name="description" required className="mt-1" placeholder="e.g. Lunch at site" />
      </div>
      <div>
        <Label htmlFor="slip">Receipt/Slip (optional)</Label>
        <Input id="slip" name="slip" type="file" accept="image/*" className="mt-1" />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm">Add Expense</Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  )
}
