"use client"

import { useState } from "react"
import { updateAppSetting } from "@/lib/actions/settings"

export function ExpenseToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [saving, setSaving] = useState(false)

  async function handleToggle() {
    setSaving(true)
    const newValue = !enabled
    try {
      await updateAppSetting("expense_tracking_enabled", newValue)
      setEnabled(newValue)
    } catch (e) {
      // Revert on error
    }
    setSaving(false)
  }

  return (
    <div className="flex items-center justify-between rounded-lg border p-4">
      <div>
        <h4 className="font-medium">Expense Tracking</h4>
        <p className="text-sm text-muted-foreground">Enable food, ticket, and accommodation expense tracking on job cards. Expenses are for back-office use only.</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        disabled={saving}
        onClick={handleToggle}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
          enabled ? "bg-primary" : "bg-neutral-subtle"
        } ${saving ? "opacity-50" : ""}`}
      >
        <span
          className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
            enabled ? "translate-x-[22px]" : "translate-x-[2px]"
          }`}
        />
      </button>
    </div>
  )
}
