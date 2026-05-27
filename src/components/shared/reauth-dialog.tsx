"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { AlertCircle, Loader2, ShieldCheck } from "lucide-react"
import { verifyPassword } from "@/lib/actions/signatures"

interface ReAuthDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  actionLabel: string
  meaning: string
  onSuccess: (reAuthToken: string) => void
  onCancel: () => void
}

export function ReAuthDialog({
  open,
  onOpenChange,
  actionLabel,
  meaning,
  onSuccess,
  onCancel,
}: ReAuthDialogProps) {
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleVerify = async () => {
    setError("")
    if (!password) {
      setError("Password is required")
      return
    }

    setLoading(true)
    const valid = await verifyPassword(password)
    setLoading(false)

    if (valid) {
      setPassword("")
      onSuccess(password)
      onOpenChange(false)
    } else {
      setError("Incorrect password. Please try again.")
    }
  }

  const handleCancel = () => {
    setPassword("")
    setError("")
    onCancel()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Electronic Signature Required
          </DialogTitle>
          <DialogDescription>
            Enter your password to sign and confirm this action:
            <br />
            <strong className="text-foreground">{actionLabel}</strong>
            <br />
            <span className="text-xs text-muted-foreground">
              This signature will be permanently recorded in the audit trail.
              Signature meaning: <strong>{meaning}</strong>
            </span>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="reauth-password">Password</Label>
            <Input
              id="reauth-password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError("") }}
              onKeyDown={(e) => e.key === "Enter" && handleVerify()}
              className={error ? "border-destructive" : ""}
              autoFocus
            />
            {error && (
              <p className="flex items-center gap-1 text-xs text-destructive">
                <AlertCircle className="h-3 w-3" />
                {error}
              </p>
            )}
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleCancel} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleVerify} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sign — {meaning}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
