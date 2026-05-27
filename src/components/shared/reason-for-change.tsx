"use client"

import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface ReasonForChangeProps {
  value: string
  onChange: (value: string) => void
  error?: string
  className?: string
}

export function ReasonForChange({ value, onChange, error, className }: ReasonForChangeProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor="reason" className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <AlertCircle className="h-3.5 w-3.5" />
        Reason for Change (required for compliance)
      </Label>
      <Textarea
        id="reason"
        name="reason"
        placeholder="e.g., Corrected serial number per asset audit, Updated location after department reorganization..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "min-h-[60px] resize-none text-sm",
          error && "border-destructive focus-visible:ring-destructive"
        )}
      />
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
      <p className="text-[11px] text-muted-foreground">
        Required per FDA 21 CFR Part 11. Every change must include a documented reason.
      </p>
    </div>
  )
}
