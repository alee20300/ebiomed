# Call Log & Engineer Visit Tracking — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional call-log fields (who answered when fault is reported) and engineer site-visit logging (QR scan at equipment) behind a single feature toggle.

**Architecture:** Three new nullable columns on `complaints` (called_department, answered_by, call_status). New `visit_logs` table linking complaints to engineer visits. `call_log_workflow_enabled` setting in `app_settings` gates all new UI and logic. Toggle OFF = zero behavior change.

**Tech Stack:** Next.js 16 App Router, Supabase (ebiomed schema), Zod, Tailwind CSS, shadcn/ui, server actions

---

### Task 1: Database Migration (0015)

**Files:**
- Create: `supabase/migrations/0015_call_log_visit_tracking.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Phase: Call Log & Engineer Visit Tracking
-- Adds call-log fields to complaints + visit_logs table + app_settings seed

-- ============================================================
-- 1. Add call-log columns to complaints
-- ============================================================
ALTER TABLE ebiomed.complaints ADD COLUMN IF NOT EXISTS called_department boolean;
ALTER TABLE ebiomed.complaints ADD COLUMN IF NOT EXISTS answered_by text;
ALTER TABLE ebiomed.complaints ADD COLUMN IF NOT EXISTS call_status text;

-- ============================================================
-- 2. visit_logs table
-- ============================================================
CREATE TABLE IF NOT EXISTS ebiomed.visit_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  complaint_id uuid NOT NULL REFERENCES ebiomed.complaints(id) ON DELETE RESTRICT,
  visited_by uuid NOT NULL REFERENCES ebiomed.profiles(id),
  visited_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 3. RLS for visit_logs
-- ============================================================
ALTER TABLE ebiomed.visit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Visit logs viewable by authenticated" ON ebiomed.visit_logs;
CREATE POLICY "Visit logs viewable by authenticated" ON ebiomed.visit_logs
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Visit logs insertable by admin or technician" ON ebiomed.visit_logs;
CREATE POLICY "Visit logs insertable by admin or technician" ON ebiomed.visit_logs
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND
    EXISTS (SELECT 1 FROM ebiomed.profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
  );

-- ============================================================
-- 4. Seed feature toggle
-- ============================================================
INSERT INTO ebiomed.app_settings (key, value) VALUES ('call_log_workflow_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 5. Grant permissions
-- ============================================================
GRANT SELECT, INSERT ON ebiomed.visit_logs TO authenticated;
```

- [ ] **Step 2: Run the migration**

```bash
npx supabase db push
```

Expected: migration applies without errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0015_call_log_visit_tracking.sql
git commit -m "feat: add call log and visit tracking migration (0015)"
```

---

### Task 2: TypeScript Types

**Files:**
- Modify: `src/lib/types/index.ts`

- [ ] **Step 1: Add VisitLog type and extend Complaint type**

In `src/lib/types/index.ts`, add the `VisitLog` interface after the `Complaint` interface (around line 74):

```ts
export interface VisitLog {
  id: string
  complaint_id: string
  visited_by: string
  visited_at: string
  created_at: string
  visited_profile?: Profile | null
}
```

Then extend the `Complaint` interface (lines 59-74) to include the new columns and optional visits:

```ts
export interface Complaint {
  id: string
  equipment_id: string
  description: string
  photo_url: string | null
  reported_by_name: string | null
  reported_by_department: string | null
  status: ComplaintStatus
  reviewer_id: string | null
  review_notes: string | null
  called_department: boolean | null
  answered_by: string | null
  call_status: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  equipment?: Equipment
  reviewer?: Profile | null
  visits?: VisitLog[]
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/types/index.ts
git commit -m "feat: add VisitLog and call-log fields to types"
```

---

### Task 3: Zod Schemas

**Files:**
- Create: `src/lib/schemas/visit-log.ts`
- Modify: `src/lib/schemas/fault-report.ts`

- [ ] **Step 1: Create visit-log schema**

Create `src/lib/schemas/visit-log.ts`:

```ts
import { z } from "zod"

export const logVisitSchema = z.object({
  complaint_id: z.string().uuid("Invalid complaint"),
})

export type LogVisitFormData = z.infer<typeof logVisitSchema>
```

- [ ] **Step 2: Add call-log fields to fault-report schema**

Modify `src/lib/schemas/fault-report.ts` — add a new export for the extended schema that includes the call-log fields:

```ts
import { z } from "zod"

export const faultReportSchema = z.object({
  equipment_id: z.string().uuid("Invalid equipment"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  reported_by_name: z.string().optional(),
  reported_by_department: z.string().optional(),
  reason: z.string().min(5, "Reason for change is required").max(500, "Reason too long").default("Fault reported via public portal"),
})

export const faultReportWithCallLogSchema = faultReportSchema.extend({
  called_department: z.coerce.boolean({ required_error: "Please indicate whether you called the department" }),
  answered_by: z.string().optional(),
  call_status: z.enum(["answered", "unanswered"]),
})

export type FaultReportFormData = z.infer<typeof faultReportSchema>
export type FaultReportWithCallLogFormData = z.infer<typeof faultReportWithCallLogSchema>
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/schemas/visit-log.ts src/lib/schemas/fault-report.ts
git commit -m "feat: add visit-log schema and call-log fault report schema"
```

---

### Task 4: Server Actions

**Files:**
- Create: `src/lib/actions/visit-logs.ts`
- Modify: `src/lib/actions/fault-report.ts`

- [ ] **Step 1: Create visit-logs server actions**

Create `src/lib/actions/visit-logs.ts`:

```ts
"use server"

import { createClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/lib/actions/profiles"
import { getAppSetting } from "@/lib/actions/settings"
import { logAudit } from "@/lib/actions/audit"
import { logVisitSchema } from "@/lib/schemas/visit-log"
import type { VisitLog } from "@/lib/types"

export async function logEngineerVisit(formData: FormData) {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) throw new Error("You must be logged in")
  if (user.role !== "admin" && user.role !== "technician") {
    throw new Error("Only admins and technicians can log visits")
  }

  const enabled = await getAppSetting("call_log_workflow_enabled")
  if (enabled !== true) throw new Error("Call log workflow is disabled")

  const raw = Object.fromEntries(formData)
  const parsed = logVisitSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(", "))
  }

  const { data: complaint } = await supabase
    .schema("ebiomed")
    .from("complaints")
    .select("id, status")
    .eq("id", parsed.data.complaint_id)
    .single()

  if (!complaint) throw new Error("Complaint not found")
  if (complaint.status === "rejected") throw new Error("Cannot log visit for a rejected complaint")

  const { data: visit, error } = await supabase
    .schema("ebiomed")
    .from("visit_logs")
    .insert({
      complaint_id: parsed.data.complaint_id,
      visited_by: user.id,
    })
    .select("id, visited_at")
    .single()

  if (error || !visit) throw new Error(error?.message || "Failed to log visit")

  await logAudit("visit_logs", visit.id, "insert", [
    { newValue: JSON.stringify({ complaint_id: parsed.data.complaint_id, visited_by: user.id, visited_at: visit.visited_at }) }
  ], `Engineer visit logged for complaint ${parsed.data.complaint_id}`)

  return { success: true, visitedAt: visit.visited_at }
}

export async function getComplaintVisits(complaintId: string): Promise<VisitLog[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .schema("ebiomed")
    .from("visit_logs")
    .select("*, visited_profile:visited_by(id, full_name, role)")
    .eq("complaint_id", complaintId)
    .order("visited_at", { ascending: false })

  return (data || []) as unknown as VisitLog[]
}

export async function getOpenComplaintsForEquipment(equipmentId: string): Promise<{ id: string; created_at: string; description: string }[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .schema("ebiomed")
    .from("complaints")
    .select("id, created_at, description")
    .eq("equipment_id", equipmentId)
    .in("status", ["pending_review", "approved"])
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  return (data || []) as { id: string; created_at: string; description: string }[]
}
```

- [ ] **Step 2: Modify fault-report server action**

Modify `src/lib/actions/fault-report.ts` — update to conditionally handle call-log fields:

```ts
"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { logAudit } from "@/lib/actions/audit"
import { getAppSetting } from "@/lib/actions/settings"
import { faultReportSchema, faultReportWithCallLogSchema } from "@/lib/schemas/fault-report"

export async function submitFaultReport(formData: FormData) {
  const supabase = await createClient()
  const raw = Object.fromEntries(formData)

  const callLogEnabled = await getAppSetting("call_log_workflow_enabled")

  const schema = callLogEnabled === true ? faultReportWithCallLogSchema : faultReportSchema
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    const messages = parsed.error.errors.map((e) => e.message).join(", ")
    return redirect(`/report?tag=${raw.equipment_tag || ""}&error=${encodeURIComponent(messages)}`)
  }

  const photo = formData.get("photo") as File | null
  if (!photo || photo.size === 0) {
    return redirect(`/report?tag=${raw.equipment_tag || ""}&error=${encodeURIComponent("Photo is required")}`)
  }

  // Build complaint insert, including conditional call-log fields
  const complaintData: Record<string, any> = {
    equipment_id: parsed.data.equipment_id,
    description: parsed.data.description,
    reported_by_name: parsed.data.reported_by_name || null,
    reported_by_department: parsed.data.reported_by_department || null,
    status: "pending_review",
  }

  if (callLogEnabled === true && "call_status" in parsed.data) {
    complaintData.called_department = parsed.data.called_department
    complaintData.answered_by = parsed.data.answered_by || null
    complaintData.call_status = parsed.data.call_status
  }

  // Create complaint
  const { data: complaint, error: complaintError } = await supabase
    .schema("ebiomed")
    .from("complaints")
    .insert(complaintData)
    .select("id, equipment_id")
    .single()

  if (complaintError || !complaint) {
    return redirect(`/report?tag=${raw.equipment_tag || ""}&error=${encodeURIComponent(complaintError?.message || "Failed to submit complaint")}`)
  }

  // Upload photo to storage (keyed by complaint ID)
  const ext = photo.name.split(".").pop() || "jpg"
  const photoPath = `${complaint.id}.${ext}`
  const { error: uploadError } = await supabase.storage
    .from("fault-photos")
    .upload(photoPath, photo, { contentType: photo.type, upsert: true })

  if (uploadError) {
    return redirect(`/report?tag=${raw.equipment_tag || ""}&error=${encodeURIComponent(uploadError.message)}`)
  }

  const { data: urlData } = supabase.storage.from("fault-photos").getPublicUrl(photoPath)

  // Update complaint with photo URL
  await supabase
    .schema("ebiomed")
    .from("complaints")
    .update({ photo_url: urlData.publicUrl })
    .eq("id", complaint.id)

  const reason = "Fault reported by " + (parsed.data.reported_by_name || "staff")
  await logAudit("complaints", complaint.id, "insert", [
    { newValue: JSON.stringify({ equipment_id: parsed.data.equipment_id, description: parsed.data.description, reported_by_name: parsed.data.reported_by_name, reported_by_department: parsed.data.reported_by_department, photo_url: urlData.publicUrl }) }
  ], reason)

  revalidatePath("/dashboard")
  revalidatePath("/complaints")
  redirect(`/report/success?complaint=${complaint.id}`)
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/fault-report.ts src/lib/actions/visit-logs.ts
git commit -m "feat: add visit-log actions and call-log conditional logic to fault report"
```

---

### Task 5: CallLogToggle Component

**Files:**
- Create: `src/components/settings/call-log-toggle.tsx`

- [ ] **Step 1: Create the toggle component**

Create `src/components/settings/call-log-toggle.tsx`:

```tsx
"use client"

import { useState } from "react"
import { updateAppSetting } from "@/lib/actions/settings"

export function CallLogToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [saving, setSaving] = useState(false)

  async function handleToggle() {
    setSaving(true)
    const newValue = !enabled
    try {
      await updateAppSetting("call_log_workflow_enabled", newValue)
      setEnabled(newValue)
    } catch (e) {
      // Revert on error
    }
    setSaving(false)
  }

  return (
    <div className="flex items-center justify-between rounded-lg border p-4">
      <div>
        <h4 className="font-medium">Call Log & Visit Tracking</h4>
        <p className="text-sm text-gray-500">
          Enable call-log fields on fault reports (who answered / unanswered) and engineer site-visit logging via QR/barcode scanning. Public fault reporters can record whether they called the biomed department and who answered.
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        disabled={saving}
        onClick={handleToggle}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
          enabled ? "bg-blue-600" : "bg-gray-200"
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/settings/call-log-toggle.tsx
git commit -m "feat: add call log toggle component"
```

---

### Task 6: Settings Page — Add Toggle

**Files:**
- Modify: `src/app/(app)/settings/page.tsx`

- [ ] **Step 1: Import and add toggle to GeneralTab**

In `src/app/(app)/settings/page.tsx`, add the import (next to the existing `ExpenseToggle` import at line 29):

```tsx
import { CallLogToggle } from "@/components/settings/call-log-toggle"
```

Then update `GeneralTab` (lines 302-311) to include both toggles:

```tsx
async function GeneralTab() {
  const expenseTracking = await getAppSetting("expense_tracking_enabled")
  const isExpenseEnabled = expenseTracking === true

  const callLogWorkflow = await getAppSetting("call_log_workflow_enabled")
  const isCallLogEnabled = callLogWorkflow === true

  return (
    <div className="space-y-4">
      <ExpenseToggle initialEnabled={isExpenseEnabled} />
      <CallLogToggle initialEnabled={isCallLogEnabled} />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/(app)/settings/page.tsx
git commit -m "feat: add call log toggle to settings general tab"
```

---

### Task 7: FaultForm — Add Call-Log Fields

**Files:**
- Modify: `src/components/report/fault-form.tsx`

- [ ] **Step 1: Add call-log fields to FaultForm**

Modify `src/components/report/fault-form.tsx` to accept a `callLogEnabled` prop and add conditional fields:

```tsx
"use client"

import { useSearchParams } from "next/navigation"
import { useState } from "react"
import { submitFaultReport } from "@/lib/actions/fault-report"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { AlertCircle, Camera } from "lucide-react"
import type { Equipment } from "@/lib/types"

interface Props {
  equipment: Equipment
  callLogEnabled: boolean
}

export function FaultForm({ equipment, callLogEnabled }: Props) {
  const searchParams = useSearchParams()
  const error = searchParams.get("error")
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [calledDepartment, setCalledDepartment] = useState<boolean | null>(null)

  return (
    <form action={submitFaultReport} className="space-y-6">
      {error && (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <input type="hidden" name="equipment_id" value={equipment.id} />
      <input type="hidden" name="equipment_tag" value={equipment.tag_number} />

      {/* Hidden fields for conditional schema — populated by JS before submit */}
      {callLogEnabled && (
        <>
          <input type="hidden" name="called_department" value={calledDepartment === true ? "true" : "false"} />
          <input type="hidden" name="call_status" value={calledDepartment ? "answered" : "unanswered"} />
        </>
      )}

      <Card>
        <CardContent className="flex items-center gap-4 p-4">
          <div>
            <p className="font-semibold">{equipment.name}</p>
            <p className="text-sm text-gray-500">Tag: {equipment.tag_number}</p>
            <p className="text-sm text-gray-500">{equipment.department} — {equipment.location}</p>
          </div>
          <StatusBadge status={equipment.status} className="ml-auto" />
        </CardContent>
      </Card>

      <div>
        <Label htmlFor="photo">Photo of Issue *</Label>
        <div className="mt-2">
          <input
            type="file"
            name="photo"
            accept="image/*"
            capture="environment"
            required
            className="hidden"
            id="photo"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) setPhotoPreview(URL.createObjectURL(file))
            }}
          />
          {photoPreview ? (
            <div className="relative">
              <img src={photoPreview} alt="Preview" className="max-h-64 rounded-lg object-cover" />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="absolute right-2 top-2"
                onClick={() => setPhotoPreview(null)}
              >
                Remove
              </Button>
            </div>
          ) : (
            <label htmlFor="photo" className="flex h-40 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 hover:border-primary">
              <Camera className="mb-2 h-8 w-8 text-gray-400" />
              <span className="text-sm text-gray-500">Tap to take photo</span>
            </label>
          )}
        </div>
      </div>

      <div>
        <Label htmlFor="description">Describe the Issue *</Label>
        <Textarea
          id="description"
          name="description"
          rows={4}
          required
          minLength={10}
          placeholder="Describe what's wrong with the equipment..."
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="reported_by_name">Your Name (optional)</Label>
          <Input id="reported_by_name" name="reported_by_name" />
        </div>
        <div>
          <Label htmlFor="reported_by_department">Department (optional)</Label>
          <Input id="reported_by_department" name="reported_by_department" />
        </div>
      </div>

      {callLogEnabled && (
        <div className="space-y-3 rounded-lg border bg-gray-50 p-4">
          <p className="text-sm font-medium">Call Log</p>

          <fieldset>
            <legend className="text-sm mb-2">Did you call the biomedical department?</legend>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="called_department_radio"
                  value="yes"
                  checked={calledDepartment === true}
                  onChange={() => setCalledDepartment(true)}
                  className="h-4 w-4"
                />
                <span className="text-sm">Yes</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="called_department_radio"
                  value="no"
                  checked={calledDepartment === false}
                  onChange={() => setCalledDepartment(false)}
                  className="h-4 w-4"
                />
                <span className="text-sm">No</span>
              </label>
            </div>
          </fieldset>

          {calledDepartment === true && (
            <div>
              <Label htmlFor="answered_by">Technician who answered</Label>
              <Input
                id="answered_by"
                name="answered_by"
                required
                placeholder="Enter the technician's name..."
              />
            </div>
          )}

          {calledDepartment === false && (
            <p className="text-sm text-orange-600">Recorded as unanswered.</p>
          )}
        </div>
      )}

      <Button type="submit" className="w-full" size="lg">
        Submit Fault Report
      </Button>
    </form>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/report/fault-form.tsx
git commit -m "feat: add call-log fields to fault form (conditional on toggle)"
```

---

### Task 8: Report Page — Pass Toggle + Visit Banner

**Files:**
- Modify: `src/app/report/page.tsx`

- [ ] **Step 1: Update props and pass toggle to FaultForm**

Replace the entire content of `src/app/report/page.tsx`:

```tsx
import { Suspense } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/lib/actions/profiles"
import { getAppSetting } from "@/lib/actions/settings"
import { getOpenComplaintsForEquipment } from "@/lib/actions/visit-logs"
import { logEngineerVisit } from "@/lib/actions/visit-logs"
import { BarcodeScanner } from "@/components/report/barcode-scanner"
import { FaultForm } from "@/components/report/fault-form"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { AlertCircle, AlertTriangle, ClipboardCheck, Clock } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

interface PageProps {
  searchParams: Promise<{ tag?: string; error?: string; action?: string }>
}

async function EquipmentChoice({ tag }: { tag: string }) {
  const supabase = await createClient()
  const user = await getCurrentUser()
  const callLogEnabled = (await getAppSetting("call_log_workflow_enabled")) === true

  const { data: equipment } = await supabase
    .schema("ebiomed")
    .from("equipment")
    .select("*")
    .eq("tag_number", tag)
    .single()

  if (!equipment) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="font-medium text-red-800">Equipment not found</p>
        <p className="mt-1 text-sm text-red-600">No equipment with tag &quot;{tag}&quot; exists.</p>
        <Link href="/report" className="mt-4 inline-block text-sm text-primary hover:underline">
          Scan another
        </Link>
      </div>
    )
  }

  const eq = equipment as any

  let openComplaints: { id: string; created_at: string; description: string }[] = []
  if (callLogEnabled && user && (user.role === "admin" || user.role === "technician")) {
    openComplaints = await getOpenComplaintsForEquipment(eq.id)
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="text-center">
            <p className="font-semibold text-lg">{eq.name}</p>
            <p className="text-sm text-gray-500">Tag: {eq.tag_number}</p>
            <p className="text-xs text-gray-400">{eq.department} — {eq.location}</p>
          </div>
        </CardContent>
      </Card>

      <Link href={`/report?tag=${tag}&action=fault`} className="block">
        <div className="flex items-center gap-4 rounded-lg border bg-white p-5 shadow-sm transition-all hover:border-red-300 hover:shadow-md">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-50">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <p className="font-semibold text-base">Report a Fault</p>
            <p className="text-sm text-gray-500">Report an issue or malfunction with this equipment</p>
          </div>
        </div>
      </Link>

      <Link href={`/checklist?tag=${tag}`} className="block">
        <div className="flex items-center gap-4 rounded-lg border bg-white p-5 shadow-sm transition-all hover:border-teal-300 hover:shadow-md">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-teal-50">
            <ClipboardCheck className="h-6 w-6 text-teal-600" />
          </div>
          <div>
            <p className="font-semibold text-base">Fill Checklist</p>
            <p className="text-sm text-gray-500">Complete an inspection checklist for this equipment</p>
          </div>
        </div>
      </Link>

      {openComplaints.length > 0 && (
        <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm font-medium text-blue-800">Open Fault Reports</p>
          {openComplaints.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-md bg-white p-3 shadow-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{c.description}</p>
                <p className="text-xs text-gray-500">Reported {new Date(c.created_at).toLocaleDateString()}</p>
              </div>
              <form action={logEngineerVisit}>
                <input type="hidden" name="complaint_id" value={c.id} />
                <Button type="submit" size="sm" variant="outline" className="ml-3 shrink-0">
                  <Clock className="mr-1.5 h-4 w-4" />
                  Log Visit
                </Button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

async function EquipmentLookup({ tag }: { tag: string }) {
  const supabase = await createClient()
  const callLogEnabled = (await getAppSetting("call_log_workflow_enabled")) === true

  const { data: equipment } = await supabase
    .schema("ebiomed")
    .from("equipment")
    .select("*")
    .eq("tag_number", tag)
    .single()

  if (!equipment) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="font-medium text-red-800">Equipment not found</p>
        <p className="mt-1 text-sm text-red-600">No equipment with tag &quot;{tag}&quot; exists.</p>
        <Link href="/report" className="mt-4 inline-block text-sm text-primary hover:underline">
          Scan another
        </Link>
      </div>
    )
  }

  return <FaultForm equipment={equipment as any} callLogEnabled={callLogEnabled} />
}

export default async function ReportPage({ searchParams }: PageProps) {
  const params = await searchParams
  const tag = params.tag
  const action = params.action

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-lg px-4 py-8">
        <div className="mb-6 text-center">
          <Link href="/report" className="text-2xl font-bold text-primary">eBiomed</Link>
          <p className="mt-1 text-sm text-gray-500">Scan Equipment QR Code</p>
        </div>

        {!tag ? (
          <BarcodeScanner />
        ) : action === "fault" ? (
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <EquipmentLookup tag={tag} />
          </Suspense>
        ) : (
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <EquipmentChoice tag={tag} />
          </Suspense>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/report/page.tsx
git commit -m "feat: add visit-logging banner and toggle-awareness to report page"
```

---

### Task 9: Complaint Detail Page — Fetch Visits

**Files:**
- Modify: `src/app/(app)/complaints/[id]/page.tsx`

- [ ] **Step 1: Fetch visits and pass to detail card**

Replace `src/app/(app)/complaints/[id]/page.tsx`:

```tsx
import Link from "next/link"
import { notFound } from "next/navigation"
import { getComplaintById } from "@/lib/actions/complaints"
import { getComplaintVisits } from "@/lib/actions/visit-logs"
import { getAppSetting } from "@/lib/actions/settings"
import { ComplaintDetailCard } from "@/components/complaints/complaint-detail-card"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ChevronLeft } from "lucide-react"

export default async function ComplaintDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const complaint = await getComplaintById(id)

  if (!complaint) notFound()

  const callLogEnabled = (await getAppSetting("call_log_workflow_enabled")) === true
  const visits = callLogEnabled ? await getComplaintVisits(id) : []

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/complaints" className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}>
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h2 className="text-2xl font-bold tracking-tight">Complaint Detail</h2>
      </div>
      <div className="rounded-lg border bg-white p-6">
        <ComplaintDetailCard complaint={complaint} visits={visits} callLogEnabled={callLogEnabled} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/(app)/complaints/[id]/page.tsx
git commit -m "feat: fetch visits on complaint detail page"
```

---

### Task 10: ComplaintDetailCard — Visit History + Call Log Display

**Files:**
- Modify: `src/components/complaints/complaint-detail-card.tsx`

- [ ] **Step 1: Add visit history and call log display sections**

Replace `src/components/complaints/complaint-detail-card.tsx`:

```tsx
"use client"

import { useState } from "react"
import { approveComplaint, rejectComplaint } from "@/lib/actions/complaints"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { StatusBadge } from "@/components/shared/status-badge"
import type { Complaint, VisitLog } from "@/lib/types"
import { Clock, Phone, PhoneOff } from "lucide-react"

export function ComplaintDetailCard({
  complaint,
  visits,
  callLogEnabled,
}: {
  complaint: Complaint
  visits: VisitLog[]
  callLogEnabled: boolean
}) {
  const [rejectOpen, setRejectOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const isPending = complaint.status === "pending_review"

  async function handleApprove() {
    setSubmitting(true)
    try {
      await approveComplaint(complaint.id)
    } catch {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold">{complaint.equipment?.name || "Unknown Equipment"}</h3>
          <p className="text-sm text-gray-500">Tag: {complaint.equipment?.tag_number || "-"}</p>
          {complaint.equipment?.department && (
            <p className="text-sm text-gray-500">Department: {complaint.equipment.department}</p>
          )}
          {complaint.equipment?.location && (
            <p className="text-sm text-gray-500">Location: {complaint.equipment.location}</p>
          )}
        </div>
        <StatusBadge status={complaint.status.replace("_", " ")} />
      </div>

      {complaint.photo_url && (
        <div>
          <Label>Fault Photo</Label>
          <img
            src={complaint.photo_url}
            alt="Fault"
            className="mt-1 max-h-64 rounded-lg border object-cover"
          />
        </div>
      )}

      <div>
        <Label>Description</Label>
        <p className="mt-1 text-sm">{complaint.description}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <Label>Reported By</Label>
          <p>{complaint.reported_by_name || "-"}</p>
        </div>
        <div>
          <Label>Department</Label>
          <p>{complaint.reported_by_department || "-"}</p>
        </div>
        <div>
          <Label>Date</Label>
          <p>{new Date(complaint.created_at).toLocaleString()}</p>
        </div>
      </div>

      {callLogEnabled && complaint.call_status && (
        <div className="rounded-lg border bg-gray-50 p-4">
          <Label>Call Log</Label>
          <div className="mt-2 flex items-center gap-2 text-sm">
            {complaint.call_status === "answered" ? (
              <>
                <Phone className="h-4 w-4 text-green-600" />
                <span>Answered by <strong>{complaint.answered_by || "Unknown"}</strong></span>
              </>
            ) : (
              <>
                <PhoneOff className="h-4 w-4 text-orange-600" />
                <span>Call was not answered</span>
              </>
            )}
          </div>
        </div>
      )}

      {callLogEnabled && visits.length > 0 && (
        <div className="rounded-lg border bg-gray-50 p-4">
          <Label>Site Visits</Label>
          <div className="mt-2 space-y-2">
            {visits.map((visit) => (
              <div key={visit.id} className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-blue-600" />
                <span>
                  {visit.visited_profile?.full_name || "Engineer"}
                  {" — "}
                  {new Date(visit.visited_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {isPending && (
        <div className="flex gap-3 border-t pt-4">
          <form action={handleApprove}>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Approving..." : "Approve & Create Work Order"}
            </Button>
          </form>
          <Button
            variant="outline"
            onClick={() => setRejectOpen(!rejectOpen)}
            disabled={submitting}
          >
            Reject
          </Button>
        </div>
      )}

      {rejectOpen && (
        <form action={async (fd) => { await rejectComplaint(complaint.id, fd) }} className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <Label htmlFor="review_notes">Rejection Reason *</Label>
          <Textarea
            id="review_notes"
            name="review_notes"
            required
            minLength={5}
            placeholder="Explain why this complaint is being rejected..."
          />
          <div className="flex gap-3">
            <Button type="submit" variant="destructive">Confirm Rejection</Button>
            <Button type="button" variant="ghost" onClick={() => setRejectOpen(false)}>Cancel</Button>
          </div>
        </form>
      )}

      {!isPending && complaint.review_notes && (
        <div className="rounded-lg border bg-gray-50 p-4">
          <Label>Review Notes</Label>
          <p className="mt-1 text-sm">{complaint.review_notes}</p>
          {complaint.reviewer && (
            <p className="mt-1 text-xs text-gray-500">Reviewed by {complaint.reviewer.full_name}</p>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/complaints/complaint-detail-card.tsx
git commit -m "feat: add visit history and call log display to complaint detail"
```

---

### Verification

After all tasks are complete, verify the full flow:

1. **Toggle OFF** — existing fault report form should work identically to before. No new fields appear.
2. **Toggle ON** — fault report form shows "Did you call the biomedical department?" radio buttons and conditional "Technician who answered" input.
3. **Toggle ON, submit with "No"** — complaint created with `call_status = 'unanswered'`.
4. **Toggle ON, submit with "Yes" and a name** — complaint created with `call_status = 'answered'` and `answered_by` set.
5. **Toggle ON, log in as engineer** — scan QR for equipment with open complaint. "Open Fault Reports" section appears with "Log Visit" button.
6. **Click "Log Visit"** — visit_logs row created. Toast or success visible.
7. **View complaint detail** — call log and visit history sections rendered correctly.
8. **Toggle OFF again** — visit banner gone, call-log fields gone, visit history gone from detail page.

```bash
npm run build
```

Expected: no TypeScript errors, build succeeds.
