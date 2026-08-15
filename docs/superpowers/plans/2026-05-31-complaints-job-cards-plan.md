# Complaints, Job Cards & Expense Tracking — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce complaints (fault report → review → WO), job cards (parallel technician work tracking), optional expense tracking, and printable WO completion reports.

**Architecture:** New `complaints` table intercepts fault reports before WO creation. New `job_cards` table (1:N from work_orders) tracks per-visit work with time entries, parts, and optional expenses. New `app_settings` table powers the expense tracking toggle. Completion report is a server-rendered print-optimized page at `/work-orders/[id]/report`.

**Tech Stack:** Next.js 15 App Router, Supabase (ebiomed schema), Zod, Tailwind CSS, shadcn/ui, server actions

---

### Task 1: Database Migration (0014)

**Files:**
- Create: `supabase/migrations/0014_complaints_job_cards.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Enums
DO $$ BEGIN
  CREATE TYPE ebiomed.complaint_status AS ENUM ('pending_review', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE ebiomed.job_card_status AS ENUM ('in_progress', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE ebiomed.expense_category AS ENUM ('food', 'ticket', 'accommodation');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- complaints table
CREATE TABLE IF NOT EXISTS ebiomed.complaints (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  equipment_id uuid NOT NULL REFERENCES ebiomed.equipment(id) ON DELETE RESTRICT,
  description text NOT NULL,
  photo_url text,
  reported_by_name text,
  reported_by_department text,
  status ebiomed.complaint_status NOT NULL DEFAULT 'pending_review',
  reviewer_id uuid REFERENCES ebiomed.profiles(id),
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- job_cards table
CREATE TABLE IF NOT EXISTS ebiomed.job_cards (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_order_id uuid NOT NULL REFERENCES ebiomed.work_orders(id) ON DELETE RESTRICT,
  technician_id uuid NOT NULL REFERENCES ebiomed.profiles(id),
  status ebiomed.job_card_status NOT NULL DEFAULT 'in_progress',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  summary text,
  unresolved_issues text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- job_card_entries (time log)
CREATE TABLE IF NOT EXISTS ebiomed.job_card_entries (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_card_id uuid NOT NULL REFERENCES ebiomed.job_cards(id) ON DELETE CASCADE,
  description text NOT NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL
);

-- job_card_parts (parts consumed per job card)
CREATE TABLE IF NOT EXISTS ebiomed.job_card_parts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_card_id uuid NOT NULL REFERENCES ebiomed.job_cards(id) ON DELETE CASCADE,
  part_id uuid NOT NULL REFERENCES ebiomed.parts(id) ON DELETE RESTRICT,
  quantity_used integer NOT NULL DEFAULT 1
);

-- job_card_expenses (optional)
CREATE TABLE IF NOT EXISTS ebiomed.job_card_expenses (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_card_id uuid NOT NULL REFERENCES ebiomed.job_cards(id) ON DELETE CASCADE,
  category ebiomed.expense_category NOT NULL,
  amount decimal(10,2) NOT NULL,
  description text NOT NULL,
  slip_url text
);

-- app_settings (feature flags)
CREATE TABLE IF NOT EXISTS ebiomed.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_by uuid REFERENCES ebiomed.profiles(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add complaint_id to work_orders
ALTER TABLE ebiomed.work_orders ADD COLUMN IF NOT EXISTS complaint_id uuid REFERENCES ebiomed.complaints(id);

-- updated_at triggers
DO $$ BEGIN
  CREATE TRIGGER set_updated_at_complaints
    BEFORE UPDATE ON ebiomed.complaints
    FOR EACH ROW EXECUTE FUNCTION ebiomed.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER set_updated_at_job_cards
    BEFORE UPDATE ON ebiomed.job_cards
    FOR EACH ROW EXECUTE FUNCTION ebiomed.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- RLS: complaints
ALTER TABLE ebiomed.complaints ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Authenticated users can view complaints" ON ebiomed.complaints FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Authenticated users can insert complaints" ON ebiomed.complaints FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Authenticated users can update complaints" ON ebiomed.complaints FOR UPDATE TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- RLS: job_cards
ALTER TABLE ebiomed.job_cards ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Authenticated users can view job cards" ON ebiomed.job_cards FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Authenticated users can insert job cards" ON ebiomed.job_cards FOR INSERT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Authenticated users can update job cards" ON ebiomed.job_cards FOR UPDATE TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- RLS: job_card_entries
ALTER TABLE ebiomed.job_card_entries ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Authenticated users can manage job card entries" ON ebiomed.job_card_entries FOR ALL TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- RLS: job_card_parts
ALTER TABLE ebiomed.job_card_parts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Authenticated users can manage job card parts" ON ebiomed.job_card_parts FOR ALL TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- RLS: job_card_expenses
ALTER TABLE ebiomed.job_card_expenses ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Authenticated users can manage job card expenses" ON ebiomed.job_card_expenses FOR ALL TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- RLS: app_settings (admin write, all read)
ALTER TABLE ebiomed.app_settings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "All authenticated users can read settings" ON ebiomed.app_settings FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Seed default settings
INSERT INTO ebiomed.app_settings (key, value) VALUES ('expense_tracking_enabled', 'false') ON CONFLICT (key) DO NOTHING;

-- Grant permissions
GRANT ALL ON ebiomed.complaints TO authenticated;
GRANT ALL ON ebiomed.job_cards TO authenticated;
GRANT ALL ON ebiomed.job_card_entries TO authenticated;
GRANT ALL ON ebiomed.job_card_parts TO authenticated;
GRANT ALL ON ebiomed.job_card_expenses TO authenticated;
GRANT SELECT, UPDATE ON ebiomed.app_settings TO authenticated;
```

- [ ] **Step 2: Apply the migration**

```bash
cd supabase && npx supabase db push
```
Expected: No errors. You may need to run `npx supabase db reset` if local dev.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0014_complaints_job_cards.sql
git commit -m "feat: add complaints, job cards, expenses, and app_settings schema"
```

---

### Task 2: Types & Schemas

**Files:**
- Modify: `src/lib/types/index.ts`
- Create: `src/lib/schemas/complaint.ts`
- Create: `src/lib/schemas/job-card.ts`
- Create: `src/lib/schemas/expense.ts`
- Create: `src/lib/schemas/settings.ts`

- [ ] **Step 1: Add new TypeScript interfaces to types/index.ts**

Insert after the `WorkOrder` interface (after line 51), before `PMSchedule`:

```ts
export type ComplaintStatus = "pending_review" | "approved" | "rejected"
export type JobCardStatus = "in_progress" | "completed"
export type ExpenseCategory = "food" | "ticket" | "accommodation"

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
  created_at: string
  updated_at: string
  deleted_at: string | null
  equipment?: Equipment
  reviewer?: Profile | null
}

export interface JobCard {
  id: string
  work_order_id: string
  technician_id: string
  status: JobCardStatus
  started_at: string
  completed_at: string | null
  summary: string | null
  unresolved_issues: string | null
  created_at: string
  updated_at: string
  technician?: Profile | null
  entries?: JobCardEntry[]
  parts?: JobCardPartUsage[]
  expenses?: JobCardExpense[]
}

export interface JobCardEntry {
  id: string
  job_card_id: string
  description: string
  started_at: string
  ended_at: string
  duration_minutes: number
}

export interface JobCardPartUsage {
  id: string
  job_card_id: string
  part_id: string
  quantity_used: number
  part?: Part | null
}

export interface JobCardExpense {
  id: string
  job_card_id: string
  category: ExpenseCategory
  amount: number
  description: string
  slip_url: string | null
}

export interface AppSetting {
  key: string
  value: any
  updated_by: string | null
  updated_at: string
}
```

- [ ] **Step 2: Add `complaint_id` to the `WorkOrder` interface**

After `description: string` (line 38), add:

```ts
  complaint_id: string | null
```

After `deleted_at: string | null` (line 47), add:

```ts
  complaint?: Complaint | null
```

- [ ] **Step 3: Create complaint schema**

Write `src/lib/schemas/complaint.ts`:

```ts
import { z } from "zod"

export const complaintReviewSchema = z.object({
  review_notes: z.string().min(5, "Review notes must be at least 5 characters").max(500, "Review notes must be under 500 characters"),
})
```

- [ ] **Step 4: Create job card schema**

Write `src/lib/schemas/job-card.ts`:

```ts
import { z } from "zod"

export const jobCardCompleteSchema = z.object({
  summary: z.string().min(10, "Summary must be at least 10 characters"),
  unresolved_issues: z.string().optional(),
})

export const jobCardEntrySchema = z.object({
  description: z.string().min(1, "Description is required"),
  started_at: z.string(),
  ended_at: z.string(),
})

export const jobCardPartSchema = z.object({
  part_id: z.string().uuid("Valid part is required"),
  quantity_used: z.coerce.number().int().min(1, "Quantity must be at least 1"),
})
```

- [ ] **Step 5: Create expense schema**

Write `src/lib/schemas/expense.ts`:

```ts
import { z } from "zod"

export const expenseSchema = z.object({
  category: z.enum(["food", "ticket", "accommodation"]),
  amount: z.coerce.number().positive("Amount must be positive"),
  description: z.string().min(1, "Description is required"),
})
```

- [ ] **Step 6: Create settings schema**

Write `src/lib/schemas/settings.ts`:

```ts
import { z } from "zod"

export const appSettingSchema = z.object({
  key: z.string().min(1),
  value: z.any(),
})
```

- [ ] **Step 7: Verify types compile**

```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: No new type errors (some may be pre-existing).

- [ ] **Step 8: Commit**

```bash
git add src/lib/types/index.ts src/lib/schemas/complaint.ts src/lib/schemas/job-card.ts src/lib/schemas/expense.ts src/lib/schemas/settings.ts
git commit -m "feat: add complaint, job card, expense, and settings types and schemas"
```

---

### Task 3: App Settings Infrastructure

**Files:**
- Create: `src/lib/actions/settings.ts`

- [ ] **Step 1: Create settings server actions**

Write `src/lib/actions/settings.ts`:

```ts
"use server"

import { createClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/lib/actions/profiles"
import { redirect } from "next/navigation"

export async function getAppSetting(key: string): Promise<any | null> {
  const supabase = await createClient()

  const { data } = await supabase
    .schema("ebiomed")
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .single()

  return data?.value ?? null
}

export async function updateAppSetting(key: string, value: any) {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) return redirect("/login")
  if (user.role !== "admin") {
    throw new Error("Only admins can update settings")
  }

  const { error } = await supabase
    .schema("ebiomed")
    .from("app_settings")
    .upsert({ key, value, updated_by: user.id, updated_at: new Date().toISOString() })

  if (error) throw new Error(error.message)
}
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit 2>&1 | head -10
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/settings.ts
git commit -m "feat: add app settings server actions"
```

---

### Task 4: Modify Fault Report — Create Complaint Instead of WO

**Files:**
- Modify: `src/lib/actions/fault-report.ts`

- [ ] **Step 1: Rewrite submitFaultReport to create a complaint**

Replace the entire content of `src/lib/actions/fault-report.ts`:

```ts
"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { logAudit } from "@/lib/actions/audit"
import { faultReportSchema } from "@/lib/schemas/fault-report"

export async function submitFaultReport(formData: FormData) {
  const supabase = await createClient()
  const raw = Object.fromEntries(formData)

  const parsed = faultReportSchema.safeParse(raw)
  if (!parsed.success) {
    const messages = parsed.error.errors.map((e) => e.message).join(", ")
    return redirect(`/report?tag=${raw.equipment_tag || ""}&error=${encodeURIComponent(messages)}`)
  }

  const photo = formData.get("photo") as File | null
  if (!photo || photo.size === 0) {
    return redirect(`/report?tag=${raw.equipment_tag || ""}&error=${encodeURIComponent("Photo is required")}`)
  }

  // Create complaint
  const { data: complaint, error: complaintError } = await supabase
    .schema("ebiomed")
    .from("complaints")
    .insert({
      equipment_id: parsed.data.equipment_id,
      description: parsed.data.description,
      reported_by_name: parsed.data.reported_by_name || null,
      reported_by_department: parsed.data.reported_by_department || null,
      status: "pending_review",
    })
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

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit 2>&1 | head -10
```
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/fault-report.ts
git commit -m "feat: change submitFaultReport to create complaint instead of work order"
```

---

### Task 5: Complaint Actions

**Files:**
- Create: `src/lib/actions/complaints.ts`
- Modify: `src/lib/actions/work-orders.ts` (accept optional complaint_id)

- [ ] **Step 1: Read the createWorkOrder signature for reference**

Open `src/lib/actions/work-orders.ts` — note `createWorkOrder(formData: FormData)` parses `workOrderSchema`. We need to make it callable internally (not just from FormData).

- [ ] **Step 2: Create complaint server actions**

Write `src/lib/actions/complaints.ts`:

```ts
"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/lib/actions/profiles"
import { logAudit } from "@/lib/actions/audit"
import { complaintReviewSchema } from "@/lib/schemas/complaint"
import { workOrderSchema } from "@/lib/schemas/work-order"
import type { Complaint } from "@/lib/types"

export async function getComplaints(): Promise<Complaint[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .schema("ebiomed")
    .from("complaints")
    .select("*, equipment(*)")
    .eq("status", "pending_review")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  return (data || []) as unknown as Complaint[]
}

export async function getComplaintById(id: string): Promise<Complaint | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .schema("ebiomed")
    .from("complaints")
    .select("*, equipment(*), reviewer:reviewer_id(*)")
    .eq("id", id)
    .single()

  if (!data) return null
  return data as unknown as Complaint
}

export async function approveComplaint(id: string, reviewNotes?: string) {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) return redirect("/login")

  // Get complaint
  const { data: complaint } = await supabase
    .schema("ebiomed")
    .from("complaints")
    .select("*")
    .eq("id", id)
    .single()

  if (!complaint) throw new Error("Complaint not found")
  if (complaint.status !== "pending_review") throw new Error("Complaint already reviewed")

  // Update complaint status
  await supabase
    .schema("ebiomed")
    .from("complaints")
    .update({
      status: "approved",
      reviewer_id: user.id,
      review_notes: reviewNotes || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)

  await logAudit("complaints", id, "update", [
    { field: "status", oldValue: "pending_review", newValue: "approved" },
  ], reviewNotes || "Complaint approved")

  // Create work order
  const { data: wo, error: woError } = await supabase
    .schema("ebiomed")
    .from("work_orders")
    .insert({
      equipment_id: complaint.equipment_id,
      type: "corrective",
      priority: "medium",
      status: "open",
      description: complaint.description,
      complaint_id: id,
      created_by: user.id,
      reported_by_name: complaint.reported_by_name,
      reported_by_department: complaint.reported_by_department,
      issue_photo_url: complaint.photo_url,
    })
    .select("id, equipment_id")
    .single()

  if (woError || !wo) throw new Error(woError?.message || "Failed to create work order")

  await logAudit("work_orders", wo.id, "insert", [
    { newValue: JSON.stringify({ equipment_id: complaint.equipment_id, description: complaint.description, complaint_id: id }) }
  ], "Created from complaint approval")

  // Set equipment to under_repair
  await supabase
    .schema("ebiomed")
    .from("equipment")
    .update({ status: "under_repair", updated_at: new Date().toISOString() })
    .eq("id", complaint.equipment_id)

  await logAudit("equipment", complaint.equipment_id, "update", [
    { field: "status", oldValue: "active", newValue: "under_repair" }
  ], "Complaint approved — equipment set to under repair")

  revalidatePath("/complaints")
  revalidatePath("/dashboard")
  revalidatePath("/work-orders")
  redirect(`/work-orders/${wo.id}`)
}

export async function rejectComplaint(id: string, formData: FormData) {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) return redirect("/login")

  const raw = Object.fromEntries(formData)
  const parsed = complaintReviewSchema.safeParse(raw)
  if (!parsed.success) {
    const messages = parsed.error.errors.map((e) => e.message).join(", ")
    throw new Error(messages)
  }

  const { data: complaint } = await supabase
    .schema("ebiomed")
    .from("complaints")
    .select("status")
    .eq("id", id)
    .single()

  if (!complaint) throw new Error("Complaint not found")
  if (complaint.status !== "pending_review") throw new Error("Complaint already reviewed")

  await supabase
    .schema("ebiomed")
    .from("complaints")
    .update({
      status: "rejected",
      reviewer_id: user.id,
      review_notes: parsed.data.review_notes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)

  await logAudit("complaints", id, "update", [
    { field: "status", oldValue: "pending_review", newValue: "rejected" },
  ], parsed.data.review_notes)

  revalidatePath("/complaints")
  revalidatePath("/dashboard")
  redirect("/complaints")
}
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/actions/complaints.ts
git commit -m "feat: add complaint actions — approve, reject, list, detail"
```

---

### Task 6: Complaint Pages

**Files:**
- Create: `src/app/(app)/complaints/page.tsx`
- Create: `src/app/(app)/complaints/[id]/page.tsx`
- Create: `src/components/complaints/complaint-table.tsx`
- Create: `src/components/complaints/complaint-detail-card.tsx`

- [ ] **Step 1: Create complaint table component**

Write `src/components/complaints/complaint-table.tsx`:

```tsx
import Link from "next/link"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { StatusBadge } from "@/components/shared/status-badge"
import type { Complaint } from "@/lib/types"

export function ComplaintTable({ complaints }: { complaints: Complaint[] }) {
  if (complaints.length === 0) {
    return <p className="py-8 text-center text-sm text-gray-500">No pending complaints.</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Equipment</TableHead>
          <TableHead>Tag</TableHead>
          <TableHead>Reported By</TableHead>
          <TableHead>Department</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Description</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {complaints.map((c) => (
          <TableRow key={c.id}>
            <TableCell>
              <Link href={`/complaints/${c.id}`} className="font-medium text-blue-600 hover:underline">
                {c.equipment?.name || "Unknown"}
              </Link>
            </TableCell>
            <TableCell className="font-mono text-sm">{c.equipment?.tag_number || "-"}</TableCell>
            <TableCell>{c.reported_by_name || "-"}</TableCell>
            <TableCell>{c.reported_by_department || "-"}</TableCell>
            <TableCell className="text-sm text-gray-500">
              {new Date(c.created_at).toLocaleDateString()}
            </TableCell>
            <TableCell className="max-w-xs truncate text-sm">{c.description}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

- [ ] **Step 2: Create complaint list page**

Write `src/app/(app)/complaints/page.tsx`:

```tsx
import { Suspense } from "react"
import { getComplaints } from "@/lib/actions/complaints"
import { ComplaintTable } from "@/components/complaints/complaint-table"
import { Skeleton } from "@/components/ui/skeleton"

async function ComplaintList() {
  const complaints = await getComplaints()
  return <ComplaintTable complaints={complaints} />
}

export default function ComplaintsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Complaints</h2>
        <p className="text-sm text-gray-500">Review and approve pending fault reports</p>
      </div>
      <div className="rounded-lg border bg-white p-6">
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          <ComplaintList />
        </Suspense>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create complaint detail card component**

Write `src/components/complaints/complaint-detail-card.tsx`:

```tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { approveComplaint, rejectComplaint } from "@/lib/actions/complaints"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { StatusBadge } from "@/components/shared/status-badge"
import type { Complaint } from "@/lib/types"

export function ComplaintDetailCard({ complaint }: { complaint: Complaint }) {
  const router = useRouter()
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
        <form action={(fd) => rejectComplaint(complaint.id, fd)} className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4">
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

- [ ] **Step 4: Create complaint detail page**

Write `src/app/(app)/complaints/[id]/page.tsx`:

```tsx
import Link from "next/link"
import { notFound } from "next/navigation"
import { getComplaintById } from "@/lib/actions/complaints"
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

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/complaints" className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}>
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h2 className="text-2xl font-bold tracking-tight">Complaint Detail</h2>
      </div>
      <div className="rounded-lg border bg-white p-6">
        <ComplaintDetailCard complaint={complaint} />
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/complaints/ src/components/complaints/
git commit -m "feat: add complaint list and detail pages"
```

---

### Task 7: Settings Page — General Tab with Expense Toggle

**Files:**
- Create: `src/components/settings/expense-toggle.tsx`
- Modify: `src/app/(app)/settings/page.tsx`

- [ ] **Step 1: Create expense toggle component**

Write `src/components/settings/expense-toggle.tsx`:

```tsx
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
        <p className="text-sm text-gray-500">Enable food, ticket, and accommodation expense tracking on job cards. Expenses are for back-office use only.</p>
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

- [ ] **Step 2: Add General tab to settings page**

In `src/app/(app)/settings/page.tsx`:

First, add the imports:

```ts
import { getAppSetting } from "@/lib/actions/settings"
import { ExpenseToggle } from "@/components/settings/expense-toggle"
```

After the closing `</div>` of the `EquipmentTab` component (around line 240), add:

```tsx
async function GeneralTab() {
  const expenseTracking = await getAppSetting("expense_tracking_enabled")
  const isEnabled = expenseTracking === true

  return (
    <div className="space-y-4">
      <ExpenseToggle initialEnabled={isEnabled} />
    </div>
  )
}
```

Then (this is the critical change), find the `<Tabs>` component in the main page export and add the new tab. The TabsList currently has: Users, Departments, Checklists, Equipment. Add **General** as the first tab.

Find this section (around line 260-280):

```tsx
<Tabs defaultValue="users" className="space-y-6">
  <TabsList>
    <TabsTrigger value="users"><Users className="mr-2 h-4 w-4" />Users</TabsTrigger>
    <TabsTrigger value="departments"><Building2 className="mr-2 h-4 w-4" />Departments</TabsTrigger>
    <TabsTrigger value="checklists"><ClipboardCheck className="mr-2 h-4 w-4" />Checklists</TabsTrigger>
    <TabsTrigger value="equipment"><Wrench className="mr-2 h-4 w-4" />Equipment</TabsTrigger>
  </TabsList>
```

Replace with:

```tsx
<Tabs defaultValue="general" className="space-y-6">
  <TabsList>
    <TabsTrigger value="general"><Settings2 className="mr-2 h-4 w-4" />General</TabsTrigger>
    <TabsTrigger value="users"><Users className="mr-2 h-4 w-4" />Users</TabsTrigger>
    <TabsTrigger value="departments"><Building2 className="mr-2 h-4 w-4" />Departments</TabsTrigger>
    <TabsTrigger value="checklists"><ClipboardCheck className="mr-2 h-4 w-4" />Checklists</TabsTrigger>
    <TabsTrigger value="equipment"><Wrench className="mr-2 h-4 w-4" />Equipment</TabsTrigger>
  </TabsList>
```

Then add the TabsContent for General (before the users TabsContent):

```tsx
  <TabsContent value="general">
    <Suspense fallback={<Skeleton className="h-32 w-full" />}>
      <GeneralTab />
    </Suspense>
  </TabsContent>
```

Verify `Settings2` is already imported (it is, line 24): `import { UserPlus, Trash2, Settings2, Users, Building2, ClipboardCheck, Wrench } from "lucide-react"`

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add src/components/settings/expense-toggle.tsx src/app/\(app\)/settings/page.tsx
git commit -m "feat: add General settings tab with expense tracking toggle"
```

---

### Task 8: Job Card Actions

**Files:**
- Create: `src/lib/actions/job-cards.ts`

- [ ] **Step 1: Create job card server actions**

Write `src/lib/actions/job-cards.ts`:

```ts
"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/lib/actions/profiles"
import { logAudit } from "@/lib/actions/audit"
import { jobCardCompleteSchema, jobCardEntrySchema, jobCardPartSchema } from "@/lib/schemas/job-card"
import type { JobCard } from "@/lib/types"

export async function createJobCard(workOrderId: string) {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) return redirect("/login")

  const { data, error } = await supabase
    .schema("ebiomed")
    .from("job_cards")
    .insert({
      work_order_id: workOrderId,
      technician_id: user.id,
      status: "in_progress",
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  await logAudit("job_cards", data.id, "insert", [
    { newValue: JSON.stringify({ work_order_id: workOrderId, technician_id: user.id }) }
  ], "Job card started")

  revalidatePath(`/work-orders/${workOrderId}`)
}

export async function completeJobCard(id: string, formData: FormData) {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) return redirect("/login")

  const raw = Object.fromEntries(formData)
  const parsed = jobCardCompleteSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(", "))
  }

  const { data: jc, error } = await supabase
    .schema("ebiomed")
    .from("job_cards")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      summary: parsed.data.summary,
      unresolved_issues: parsed.data.unresolved_issues || null,
    })
    .eq("id", id)
    .select("work_order_id")
    .single()

  if (error) throw new Error(error.message)

  await logAudit("job_cards", id, "update", [
    { field: "status", oldValue: "in_progress", newValue: "completed" },
  ], "Job card completed")

  revalidatePath(`/work-orders/${jc.work_order_id}`)
}

export async function getJobCards(workOrderId: string): Promise<JobCard[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .schema("ebiomed")
    .from("job_cards")
    .select("*, technician:technician_id(full_name), entries:job_card_entries(*), parts:job_card_parts(*, part:part_id(name)), expenses:job_card_expenses(*)")
    .eq("work_order_id", workOrderId)
    .order("created_at", { ascending: false })

  return (data || []) as unknown as JobCard[]
}

export async function addJobCardEntry(jobCardId: string, formData: FormData) {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) return redirect("/login")

  const raw = Object.fromEntries(formData)
  const parsed = jobCardEntrySchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(", "))
  }

  const started = new Date(parsed.data.started_at)
  const ended = new Date(parsed.data.ended_at)
  const durationMinutes = Math.round((ended.getTime() - started.getTime()) / 60000)

  const { error } = await supabase
    .schema("ebiomed")
    .from("job_card_entries")
    .insert({
      job_card_id: jobCardId,
      description: parsed.data.description,
      started_at: parsed.data.started_at,
      ended_at: parsed.data.ended_at,
      duration_minutes: durationMinutes,
    })

  if (error) throw new Error(error.message)

  const { data: jc } = await supabase
    .schema("ebiomed")
    .from("job_cards")
    .select("work_order_id")
    .eq("id", jobCardId)
    .single()

  revalidatePath(`/work-orders/${jc?.work_order_id}`)
}

export async function addJobCardPart(jobCardId: string, formData: FormData) {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) return redirect("/login")

  const raw = Object.fromEntries(formData)
  const parsed = jobCardPartSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(", "))
  }

  const { error } = await supabase
    .schema("ebiomed")
    .from("job_card_parts")
    .insert({
      job_card_id: jobCardId,
      part_id: parsed.data.part_id,
      quantity_used: parsed.data.quantity_used,
    })

  if (error) throw new Error(error.message)

  const { data: jc } = await supabase
    .schema("ebiomed")
    .from("job_cards")
    .select("work_order_id")
    .eq("id", jobCardId)
    .single()

  revalidatePath(`/work-orders/${jc?.work_order_id}`)
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/job-cards.ts
git commit -m "feat: add job card server actions — create, complete, time entries, parts"
```

---

### Task 9: Expense Actions

**Files:**
- Create: `src/lib/actions/expenses.ts`

- [ ] **Step 1: Create expense server actions**

Write `src/lib/actions/expenses.ts`:

```ts
"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/lib/actions/profiles"
import { getAppSetting } from "@/lib/actions/settings"
import { expenseSchema } from "@/lib/schemas/expense"

export async function addJobCardExpense(jobCardId: string, formData: FormData) {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) return redirect("/login")

  const enabled = await getAppSetting("expense_tracking_enabled")
  if (enabled !== true) {
    throw new Error("Expense tracking is disabled")
  }

  const raw = Object.fromEntries(formData)
  const parsed = expenseSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(", "))
  }

  // Handle slip upload
  let slipUrl: string | null = null
  const slip = formData.get("slip") as File | null
  if (slip && slip.size > 0) {
    const ext = slip.name.split(".").pop() || "jpg"
    // Insert first to get an ID for the path
    const { data: expense, error: insertError } = await supabase
      .schema("ebiomed")
      .from("job_card_expenses")
      .insert({
        job_card_id: jobCardId,
        category: parsed.data.category,
        amount: parsed.data.amount,
        description: parsed.data.description,
      })
      .select("id")
      .single()

    if (insertError || !expense) throw new Error(insertError?.message || "Failed to add expense")

    const slipPath = `${jobCardId}/${expense.id}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from("expense-slips")
      .upload(slipPath, slip, { contentType: slip.type, upsert: true })

    if (!uploadError) {
      const { data: urlData } = await supabase.storage.from("expense-slips").createSignedUrl(slipPath, 3600)
      slipUrl = urlData?.signedUrl || null

      if (slipUrl) {
        await supabase
          .schema("ebiomed")
          .from("job_card_expenses")
          .update({ slip_url: slipUrl })
          .eq("id", expense.id)
      }
    }

    const { data: jc } = await supabase
      .schema("ebiomed")
      .from("job_cards")
      .select("work_order_id")
      .eq("id", jobCardId)
      .single()

    revalidatePath(`/work-orders/${jc?.work_order_id}`)
    return
  }

  // No slip
  const { error } = await supabase
    .schema("ebiomed")
    .from("job_card_expenses")
    .insert({
      job_card_id: jobCardId,
      category: parsed.data.category,
      amount: parsed.data.amount,
      description: parsed.data.description,
    })

  if (error) throw new Error(error.message)

  const { data: jc } = await supabase
    .schema("ebiomed")
    .from("job_cards")
    .select("work_order_id")
    .eq("id", jobCardId)
    .single()

  revalidatePath(`/work-orders/${jc?.work_order_id}`)
}

export async function deleteJobCardExpense(id: string) {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) return redirect("/login")

  const { data: expense } = await supabase
    .schema("ebiomed")
    .from("job_card_expenses")
    .select("job_card_id")
    .eq("id", id)
    .single()

  const { error } = await supabase
    .schema("ebiomed")
    .from("job_card_expenses")
    .delete()
    .eq("id", id)

  if (error) throw new Error(error.message)

  if (expense) {
    const { data: jc } = await supabase
      .schema("ebiomed")
      .from("job_cards")
      .select("work_order_id")
      .eq("id", expense.job_card_id)
      .single()

    revalidatePath(`/work-orders/${jc?.work_order_id}`)
  }
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/expenses.ts
git commit -m "feat: add expense server actions with toggle guard and slip uploads"
```

---

### Task 10: Job Card + Expense UI Components

**Files:**
- Create: `src/components/work-orders/job-card-section.tsx`
- Create: `src/components/work-orders/job-card-detail.tsx`
- Create: `src/components/work-orders/time-entry-form.tsx`
- Create: `src/components/work-orders/expense-form.tsx`

- [ ] **Step 1: Create time entry form**

Write `src/components/work-orders/time-entry-form.tsx`:

```tsx
"use client"

import { useState } from "react"
import { addJobCardEntry } from "@/lib/actions/job-cards"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export function TimeEntryForm({ jobCardId }: { jobCardId: string }) {
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        + Add Time Entry
      </Button>
    )
  }

  return (
    <form action={(fd) => { addJobCardEntry(jobCardId, fd); setOpen(false) }} className="space-y-3 rounded-lg border p-3">
      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" required className="mt-1" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="started_at">Start Time</Label>
          <Input id="started_at" name="started_at" type="datetime-local" required className="mt-1" />
        </div>
        <div>
          <Label htmlFor="ended_at">End Time</Label>
          <Input id="ended_at" name="ended_at" type="datetime-local" required className="mt-1" />
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm">Save Entry</Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: Create expense form**

Write `src/components/work-orders/expense-form.tsx`:

```tsx
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
    <form action={(fd) => { addJobCardExpense(jobCardId, fd); setOpen(false) }} className="space-y-3 rounded-lg border p-3">
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
```

- [ ] **Step 3: Create job card detail component**

Write `src/components/work-orders/job-card-detail.tsx`:

```tsx
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
            <form action={(fd) => completeJobCard(jobCard.id, fd)} className="space-y-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
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
```

- [ ] **Step 4: Create job card section wrapper**

Write `src/components/work-orders/job-card-section.tsx`:

```tsx
import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { getJobCards } from "@/lib/actions/job-cards"
import { createJobCard } from "@/lib/actions/job-cards"
import { getAppSetting } from "@/lib/actions/settings"
import { JobCardDetail } from "@/components/work-orders/job-card-detail"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

async function JobCardList({ workOrderId }: { workOrderId: string }) {
  const jobCards = await getJobCards(workOrderId)
  const expenseEnabled = await getAppSetting("expense_tracking_enabled") === true

  if (jobCards.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-gray-500">
        No job cards yet. Start one to track work on this order.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {jobCards.map((jc) => (
        <JobCardDetail key={jc.id} jobCard={jc} expenseEnabled={expenseEnabled} />
      ))}
    </div>
  )
}

export function JobCardSection({
  workOrderId,
  woStatus,
}: {
  workOrderId: string
  woStatus: string
}) {
  const canStart = woStatus === "open" || woStatus === "in_progress"

  return (
    <div className="rounded-lg border bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Job Cards</h3>
        {canStart && (
          <form action={async () => {
            "use server"
            await createJobCard(workOrderId)
          }}>
            <Button type="submit">Start Job Card</Button>
          </form>
        )}
      </div>
      <Suspense fallback={<Skeleton className="h-48 w-full" />}>
        <JobCardList workOrderId={workOrderId} />
      </Suspense>
    </div>
  )
}
```

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 6: Commit**

```bash
git add src/components/work-orders/job-card-section.tsx src/components/work-orders/job-card-detail.tsx src/components/work-orders/time-entry-form.tsx src/components/work-orders/expense-form.tsx
git commit -m "feat: add job card detail, time entry, and expense form components"
```

---

### Task 11: WO Detail Page Integration

**Files:**
- Modify: `src/app/(app)/work-orders/[id]/page.tsx`

- [ ] **Step 1: Add job card section and print report button**

Replace `src/app/(app)/work-orders/[id]/page.tsx`:

```tsx
import Link from "next/link"
import { notFound } from "next/navigation"
import { getWorkOrderById } from "@/lib/actions/work-orders"
import { WorkOrderDetailCard } from "@/components/work-orders/wo-detail-card"
import { CommentTimeline } from "@/components/work-orders/comment-timeline"
import { JobCardSection } from "@/components/work-orders/job-card-section"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ChevronLeft, Printer } from "lucide-react"

export default async function WorkOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const wo = await getWorkOrderById(id)

  if (!wo) notFound()

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/work-orders" className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}>
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h2 className="text-2xl font-bold tracking-tight">Work Order Detail</h2>
        </div>
        {wo.status === "completed" && (
          <Link
            href={`/work-orders/${wo.id}/report`}
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            <Printer className="mr-2 h-4 w-4" />
            Print Report
          </Link>
        )}
      </div>

      <div className="rounded-lg border bg-white p-6">
        <WorkOrderDetailCard workOrder={wo} />
      </div>

      <JobCardSection workOrderId={id} woStatus={wo.status} />

      <div className="rounded-lg border bg-white p-6">
        <CommentTimeline workOrderId={id} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit 2>&1 | head -10
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/work-orders/\[id\]/page.tsx
git commit -m "feat: integrate job cards and print report button on WO detail page"
```

---

### Task 12: WO Completion Report (Route + Component)

**Files:**
- Create: `src/app/(app)/work-orders/[id]/report/page.tsx`
- Create: `src/components/work-orders/wo-completion-report.tsx`

- [ ] **Step 1: Create completion report component**

Write `src/components/work-orders/wo-completion-report.tsx`:

```tsx
import { getWorkOrderById } from "@/lib/actions/work-orders"
import { getJobCards } from "@/lib/actions/job-cards"
import { notFound } from "next/navigation"

function formatMinutes(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export async function WOCompletionReport({ id }: { id: string }) {
  const wo = await getWorkOrderById(id)
  if (!wo) notFound()

  const jobCards = await getJobCards(id)
  const completedCards = jobCards.filter((jc) => jc.status === "completed")

  const totalLabor = jobCards.reduce((sum, jc) => {
    return sum + (jc.entries?.reduce((s, e) => s + e.duration_minutes, 0) || 0)
  }, 0)

  const totalParts = jobCards.reduce((sum, jc) => {
    return sum + (jc.parts?.reduce((s, p) => s + p.quantity_used, 0) || 0)
  }, 0)

  return (
    <div className="mx-auto max-w-[210mm] bg-white p-8 print:p-0">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .report-container, .report-container * { visibility: visible; }
          .report-container { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="report-container">
        {/* Header */}
        <div className="mb-6 border-b-2 border-black pb-4 text-center">
          <h1 className="text-xl font-bold">BIOMEDICAL EQUIPMENT SERVICE REPORT</h1>
          <p className="mt-1 text-sm text-gray-600">Work Order #{id.slice(0, 8)}</p>
        </div>

        {/* Equipment Info */}
        <div className="mb-6 grid grid-cols-2 gap-1 text-sm">
          <div><strong>Equipment:</strong> {wo.equipment?.name || "-"}</div>
          <div><strong>Asset Tag:</strong> {wo.equipment?.tag_number || "-"}</div>
          <div><strong>Department:</strong> {wo.equipment?.department || "-"}</div>
          <div><strong>Serial:</strong> {wo.equipment?.serial_number || "-"}</div>
          <div><strong>WO Type:</strong> {wo.type}</div>
          <div><strong>Priority:</strong> {wo.priority}</div>
          <div><strong>Reported:</strong> {new Date(wo.created_at).toLocaleString()}</div>
          <div><strong>Completed:</strong> {wo.completed_at ? new Date(wo.completed_at).toLocaleString() : "-"}</div>
          <div className="col-span-2 mt-2"><strong>Fault Description:</strong> {wo.description}</div>
        </div>

        {/* Service Performed */}
        <div className="mb-6">
          <h2 className="mb-3 border-b pb-1 text-base font-bold">Service Performed</h2>

          {completedCards.length === 0 ? (
            <p className="text-sm text-gray-500">No completed job cards.</p>
          ) : (
            completedCards.map((jc) => {
              const jcMinutes = jc.entries?.reduce((s, e) => s + e.duration_minutes, 0) || 0
              const jcParts = jc.parts?.length || 0
              return (
                <div key={jc.id} className="mb-4 rounded border bg-gray-50 p-3 text-sm">
                  <div className="mb-1 flex justify-between">
                    <strong>Job Card</strong>
                    <span className="text-gray-600">
                      {jc.technician?.full_name || "Unknown"} · {new Date(jc.started_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="mb-2 text-xs text-gray-600">
                    <strong>Time:</strong> {formatMinutes(jcMinutes)} · <strong>Parts:</strong> {jcParts} items
                  </div>
                  <div className="text-sm"><strong>Work Done:</strong> {jc.summary}</div>
                  {jc.unresolved_issues && (
                    <div className="mt-1 text-sm text-red-700"><strong>Unresolved:</strong> {jc.unresolved_issues}</div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Totals */}
        <div className="mb-6 border-t-2 border-black pt-3 text-sm">
          <div className="flex justify-between"><span>Total Labor:</span><strong>{formatMinutes(totalLabor)}</strong></div>
          <div className="flex justify-between"><span>Total Parts Used:</span><strong>{totalParts} items</strong></div>
          <div className="flex justify-between"><span>Total Downtime:</span><strong>{wo.downtime_minutes ? formatMinutes(wo.downtime_minutes) : "N/A"}</strong></div>
        </div>

        {/* Signatures */}
        <div className="mt-10 flex justify-between border-t pt-4 text-sm">
          <div className="text-center">
            <div className="mb-1 w-40 border-b border-black">&nbsp;</div>
            <span className="text-xs text-gray-600">Technician Signature</span>
          </div>
          <div className="text-center">
            <div className="mb-1 w-40 border-b border-black">&nbsp;</div>
            <span className="text-xs text-gray-600">Supervisor Signature</span>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 border-t pt-2 text-center text-[10px] text-gray-400">
          Generated by eBiomed CMMS · Report ID: RPT-{id.slice(0, 8)}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create report page route**

Write `src/app/(app)/work-orders/[id]/report/page.tsx`:

```tsx
import Link from "next/link"
import { WOCompletionReport } from "@/components/work-orders/wo-completion-report"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ChevronLeft, Printer } from "lucide-react"

export default async function WOReportPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <div className="space-y-4">
      <div className="no-print flex items-center gap-2">
        <Link href={`/work-orders/${id}`} className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}>
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h2 className="text-2xl font-bold tracking-tight">Completion Report</h2>
        <button
          onClick={() => window.print()}
          className={cn(buttonVariants({ variant: "outline" }), "ml-auto")}
        >
          <Printer className="mr-2 h-4 w-4" />
          Print Report
        </button>
      </div>
      <WOCompletionReport id={id} />
    </div>
  )
}
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/work-orders/\[id\]/report/ src/components/work-orders/wo-completion-report.tsx
git commit -m "feat: add printable WO completion report page"
```

---

### Task 13: Dashboard — Pending Complaints Card

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Read current dashboard stats card pattern**

Check `src/components/dashboard/stats-cards.tsx` for the pattern used.

- [ ] **Step 2: Add pending complaints query**

In `src/app/(app)/dashboard/page.tsx`, find the `getWorkOrders()` call and similar data fetch pattern. Add a new stat for pending complaints.

Open the dashboard page and add a new import:

```ts
import { getComplaints } from "@/lib/actions/complaints"
```

Find the stats query section (around where `StatsCards` receives props) and add the complaints count.

Look for this pattern in the dashboard page (check the section where stats data is fetched). The existing pattern uses `StatsCards` component with props like `totalWorkOrders`, `openCount`, etc. Add:

```tsx
const complaints = await getComplaints()
const pendingComplaintsCount = complaints.length
```

Then pass `pendingComplaintsCount` to the `StatsCards` component.

- [ ] **Step 3: Update StatsCards component**

Modify `src/components/dashboard/stats-cards.tsx` to accept and display the new prop.

Add to the Props interface:
```ts
  pendingComplaintsCount: number
```

Add a new stat card in the JSX (matching the existing card pattern):

```tsx
<Card>
  <CardContent className="p-4">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-500">Pending Complaints</p>
        <p className="text-2xl font-bold">{pendingComplaintsCount}</p>
      </div>
      <ClipboardList className="h-8 w-8 text-amber-500" />
    </div>
  </CardContent>
</Card>
```

Add the import: `import { ClipboardList } from "lucide-react"` (check if already imported).

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/dashboard/page.tsx src/components/dashboard/stats-cards.tsx
git commit -m "feat: add pending complaints stat card to dashboard"
```

---

### Task 14: Report Success Page Update

**Files:**
- Modify: `src/app/report/success/page.tsx`

- [ ] **Step 1: Update success message**

Read the current success page, then update it to show the complaint reference.

The current page shows a work order ID. Change it to show the complaint ID and updated messaging:

Find the `searchParams` pattern and replace the work order reference with complaint reference. The page currently reads `?wo=` — it should now read `?complaint=`.

```tsx
import Link from "next/link"

export default async function ReportSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ complaint?: string }>
}) {
  const { complaint } = await searchParams

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md space-y-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-gray-900">Complaint Submitted</h1>
          <p className="text-gray-600">
            Your fault report has been submitted for review. The biomedical team will review it and create a work order if needed.
          </p>
          {complaint && (
            <p className="text-sm text-gray-500">
              Reference: {complaint.slice(0, 8)}
            </p>
          )}
        </div>
        <Link
          href="/report"
          className="inline-block text-sm font-medium text-blue-600 hover:text-blue-800"
        >
          Report Another Issue
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit 2>&1 | head -10
```

- [ ] **Step 3: Commit**

```bash
git add src/app/report/success/page.tsx
git commit -m "feat: update report success page for complaint flow"
```

---

### Task 15: Final Integration Check

- [ ] **Step 1: Add expense-slips storage bucket**

Create the Supabase storage bucket. Add to your seed or migration, or create manually in Supabase dashboard:
- Bucket name: `expense-slips`
- Public: No (private)
- Allowed MIME types: `image/*`

- [ ] **Step 2: Full type check**

```bash
npx tsc --noEmit 2>&1
```
Expected: Zero errors.

- [ ] **Step 3: Run lint**

```bash
npx eslint src/ --ext .ts,.tsx 2>&1 | tail -20
```

- [ ] **Step 4: Test dev server**

```bash
npm run dev
```
Verify `http://localhost:3000/complaints` loads (shows empty state), `/settings` has General tab, and WO detail shows job card section.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: final integration — expense-slips bucket and verification"
```
