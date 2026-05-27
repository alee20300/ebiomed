"use client"

import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ReasonForChange } from "@/components/shared/reason-for-change"
import { createReferenceStandard, updateReferenceStandard, deleteReferenceStandard } from "@/lib/actions/calibration"
import { Plus, Edit, Trash2, AlertTriangle } from "lucide-react"
import { format, isPast, parseISO } from "date-fns"
import { cn } from "@/lib/utils"
import type { ReferenceStandard } from "@/lib/types"

interface Props {
  standards: ReferenceStandard[]
}

export function ReferenceStandardsTable({ standards }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ReferenceStandard | null>(null)
  const [reason, setReason] = useState("")

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{standards.length} reference standards</p>
        <form action={createReferenceStandard}>
          <Button type="button" size="sm" onClick={() => { setEditing(null); setDialogOpen(true); setReason("") }}>
            <Plus className="mr-1 h-4 w-4" />
            Add Standard
          </Button>
        </form>
      </div>

      {standards.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No reference standards configured.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Serial Number</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Certificate #</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {standards.map((std) => {
                const isExpired = isPast(parseISO(std.certificate_expiry))
                const status = isExpired && std.status === "active" ? "expired" : std.status
                return (
                  <TableRow key={std.id}>
                    <TableCell className="font-mono text-xs">{std.serial_number}</TableCell>
                    <TableCell className="font-medium">{std.name}</TableCell>
                    <TableCell className="font-mono text-xs">{std.certificate_number || "—"}</TableCell>
                    <TableCell className={cn("text-xs", isExpired && "text-destructive font-medium")}>
                      {format(parseISO(std.certificate_expiry), "yyyy-MM-dd")}
                      {isExpired && <AlertTriangle className="ml-1 inline h-3 w-3" />}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn(
                        "text-xs capitalize",
                        status === "active" && "bg-green-100 text-green-800",
                        status === "expired" && "bg-red-100 text-red-800",
                        status === "retired" && "bg-gray-100 text-gray-800",
                      )}>
                        {status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{std.location || "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => { setEditing(std); setDialogOpen(true); setReason(("")); }}
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <form action={async () => {
                          if (confirm(`Delete ${std.name}? This will soft-delete the record.`)) {
                            await deleteReferenceStandard(std.id, "Deleted by user")
                          }
                        }}>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" type="submit">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </form>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <ReferenceStandardDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        reason={reason}
        onReasonChange={setReason}
      />
    </div>
  )
}

function ReferenceStandardDialog({
  open, onOpenChange, editing, reason, onReasonChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: ReferenceStandard | null
  reason: string
  onReasonChange: (v: string) => void
}) {
  const [reasonError, setReasonError] = useState("")

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!reason || reason.length < 5) {
      setReasonError("Reason for change is required (min 5 characters)")
      return
    }
    setReasonError("")
    e.currentTarget.submit()
  }

  const action = editing
    ? updateReferenceStandard.bind(null, editing.id)
    : createReferenceStandard

  const today = format(new Date(), "yyyy-MM-dd")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Reference Standard" : "Add Reference Standard"}</DialogTitle>
        </DialogHeader>
        <form action={action} onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" name="name" defaultValue={editing?.name || ""} required />
            </div>
            <div>
              <Label htmlFor="serial_number">Serial Number *</Label>
              <Input id="serial_number" name="serial_number" defaultValue={editing?.serial_number || ""} required />
            </div>
            <div>
              <Label htmlFor="certificate_number">Certificate Number</Label>
              <Input id="certificate_number" name="certificate_number" defaultValue={editing?.certificate_number || ""} />
            </div>
            <div>
              <Label htmlFor="manufacturer">Manufacturer</Label>
              <Input id="manufacturer" name="manufacturer" defaultValue={editing?.manufacturer || ""} />
            </div>
            <div>
              <Label htmlFor="model">Model</Label>
              <Input id="model" name="model" defaultValue={editing?.model || ""} />
            </div>
            <div>
              <Label htmlFor="certificate_expiry">Cert Expiry *</Label>
              <Input
                id="certificate_expiry"
                name="certificate_expiry"
                type="date"
                min={today}
                defaultValue={editing?.certificate_expiry ? editing.certificate_expiry.slice(0, 10) : ""}
                required
              />
            </div>
            <div>
              <Label htmlFor="calibration_interval_days">Interval (days)</Label>
              <Input
                id="calibration_interval_days"
                name="calibration_interval_days"
                type="number"
                min="1"
                defaultValue={editing?.calibration_interval_days || 365}
              />
            </div>
            <div>
              <Label htmlFor="location">Location</Label>
              <Input id="location" name="location" defaultValue={editing?.location || ""} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" defaultValue={editing?.notes || ""} rows={2} />
            </div>
          </div>
          <ReasonForChange value={reason} onChange={(v) => { onReasonChange(v); setReasonError("") }} error={reasonError} />
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">{editing ? "Save Changes" : "Add Standard"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
