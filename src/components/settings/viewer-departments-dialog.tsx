"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Settings2 } from "lucide-react"
import type { Department } from "@/lib/types"

interface Props {
  viewerId: string
  viewerName: string
  departments: Department[]
}

export function ViewerDepartmentsDialog({ viewerId, viewerName, departments }: Props) {
  const [selected, setSelected] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const supabase = createClient()
    supabase
      .from("viewer_departments")
      .select("department_id")
      .eq("viewer_id", viewerId)
      .then(({ data }) => {
        setSelected((data || []).map((r: { department_id: string }) => r.department_id))
        setLoading(false)
      })
  }, [open, viewerId])

  const toggle = (deptId: string) => {
    setSelected((prev) =>
      prev.includes(deptId) ? prev.filter((id) => id !== deptId) : [...prev, deptId]
    )
  }

  const save = async () => {
    setSaving(true)
    const formData = new FormData()
    formData.append("viewer_id", viewerId)
    selected.forEach((id) => formData.append("department_ids", id))

    const { saveViewerDepartments } = await import("@/lib/actions/departments")
    await saveViewerDepartments(formData)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Settings2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Departments — {viewerName}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : departments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No departments configured. Add departments first.</p>
        ) : (
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {departments.map((dept) => (
              <div key={dept.id} className="flex items-center gap-2">
                <Checkbox
                  id={`dept-${dept.id}`}
                  checked={selected.includes(dept.id)}
                  onCheckedChange={() => toggle(dept.id)}
                />
                <Label htmlFor={`dept-${dept.id}`} className="cursor-pointer text-sm">
                  {dept.name}
                </Label>
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || loading}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
