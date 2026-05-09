# Production Readiness Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all critical security, data integrity, and core functionality gaps identified in the gap analysis so the app is safe and usable in production.

**Architecture:** Four-phase rollout. Phase 1 locks down security (middleware, schema, RLS). Phase 2 fills missing core pages (equipment edit, PM detail/create, parts consumption). Phase 3 enforces business rules and adds reporting value. Phase 4 polishes UX and mobile navigation.

**Tech Stack:** Next.js 16 App Router, React 19, Supabase PostgreSQL, Tailwind CSS, shadcn/ui, Zod

---

## Phase 1: Security & Foundation

---

### Task 1: Create `src/middleware.ts` to wire auth protection

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: Create the middleware file**

```ts
import { type NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"

export async function middleware(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
```

- [ ] **Step 2: Verify middleware compiles**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/dashboard 2>/dev/null
```

Expected: `307` (redirect to `/login` for unauthenticated users)

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "fix: wire auth middleware to protect all routes"
```

---

### Task 2: Fix database schema — make 0001 use `ebiomed` schema

**Files:**
- Modify: `supabase/migrations/0001_initial_schema.sql`

- [ ] **Step 1: Add CREATE SCHEMA at the top of migration**

Insert at line 1:

```sql
CREATE SCHEMA IF NOT EXISTS ebiomed;
```

- [ ] **Step 2: Prefix all CREATE TABLE with `ebiomed.`**

Replace all unqualified `CREATE TABLE` statements in the file:
- `CREATE TABLE profiles` → `CREATE TABLE ebiomed.profiles`
- `CREATE TABLE equipment` → `CREATE TABLE ebiomed.equipment`
- `CREATE TABLE work_orders` → `CREATE TABLE ebiomed.work_orders`
- `CREATE TABLE pm_schedules` → `CREATE TABLE ebiomed.pm_schedules`
- `CREATE TABLE parts` → `CREATE TABLE ebiomed.parts`
- `CREATE TABLE parts_usage` → `CREATE TABLE ebiomed.parts_usage`

Also update `REFERENCES` clauses (e.g., `REFERENCES equipment(id)` → `REFERENCES ebiomed.equipment(id)`).

- [ ] **Step 3: Verify no unqualified table names remain**

```bash
grep "CREATE TABLE " supabase/migrations/0001_initial_schema.sql | grep -v "ebiomed\."
```

Expected: no output (all tables prefixed)

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0001_initial_schema.sql
git commit -m "fix: prefix all tables with ebiomed schema in migration 0001"
```

---

### Task 3: Add RLS policies migration

**Files:**
- Create: `supabase/migrations/0005_rls_policies.sql`

- [ ] **Step 1: Create the migration**

```sql
-- Enable RLS on all tables
ALTER TABLE ebiomed.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ebiomed.equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE ebiomed.work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE ebiomed.pm_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE ebiomed.parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ebiomed.parts_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE ebiomed.wo_comments ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read all profiles, update their own
CREATE POLICY "Profiles are viewable by all authenticated users" ON ebiomed.profiles
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can update own profile" ON ebiomed.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Equipment: viewable by all authenticated, editable by admin/technician
CREATE POLICY "Equipment viewable by authenticated" ON ebiomed.equipment
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Equipment editable by admin or technician" ON ebiomed.equipment
  FOR ALL USING (
    auth.role() = 'authenticated' AND
    EXISTS (SELECT 1 FROM ebiomed.profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
  );

-- Work Orders: viewable by all authenticated, editable by admin/technician or assignee
CREATE POLICY "WO viewable by authenticated" ON ebiomed.work_orders
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "WO editable by admin, technician, or assignee" ON ebiomed.work_orders
  FOR ALL USING (
    auth.role() = 'authenticated' AND
    (
      EXISTS (SELECT 1 FROM ebiomed.profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
      OR assigned_to = auth.uid()
    )
  );

-- PM Schedules: viewable by all, editable by admin/technician
CREATE POLICY "PM viewable by authenticated" ON ebiomed.pm_schedules
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "PM editable by admin or technician" ON ebiomed.pm_schedules
  FOR ALL USING (
    auth.role() = 'authenticated' AND
    EXISTS (SELECT 1 FROM ebiomed.profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
  );

-- Parts: viewable by all, editable by admin/technician
CREATE POLICY "Parts viewable by authenticated" ON ebiomed.parts
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Parts editable by admin or technician" ON ebiomed.parts
  FOR ALL USING (
    auth.role() = 'authenticated' AND
    EXISTS (SELECT 1 FROM ebiomed.profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
  );

-- Parts Usage: viewable by all, insertable by technician/admin
CREATE POLICY "Parts usage viewable by authenticated" ON ebiomed.parts_usage
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Parts usage insertable by admin or technician" ON ebiomed.parts_usage
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND
    EXISTS (SELECT 1 FROM ebiomed.profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
  );

-- Comments: viewable by all, insertable by authenticated
CREATE POLICY "Comments viewable by authenticated" ON ebiomed.wo_comments
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Comments insertable by authenticated" ON ebiomed.wo_comments
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0005_rls_policies.sql
git commit -m "security: add RLS policies to all tables"
```

---

### Task 4: Fix `signup` action to respect role from form

**Files:**
- Modify: `src/lib/actions/profiles.ts:23-45`

- [ ] **Step 1: Read role from formData and pass it to insert**

Replace the signup function body:

```ts
export async function signup(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const fullName = formData.get("fullName") as string
  const role = (formData.get("role") as string) || "technician"

  const { data, error } = await supabase.auth.signUp({ email, password })

  if (error) {
    return redirect("/login?error=" + encodeURIComponent(error.message))
  }

  if (data.user) {
    await supabase.schema("public").from("profiles").insert({
      id: data.user.id,
      full_name: fullName,
      role,
    })
  }

  redirect("/login?message=Check your email to confirm your account")
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/actions/profiles.ts
git commit -m "fix: signup action respects role from form"
```

---

### Task 5: Set `NEXT_PUBLIC_SITE_URL` in env

**Files:**
- Modify: `.env.local`

- [ ] **Step 1: Add the variable**

Append to `.env.local`:

```
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

(Replace with production URL in production environment.)

- [ ] **Step 2: Commit**

```bash
git add .env.local
git commit -m "chore: add NEXT_PUBLIC_SITE_URL env variable"
```

---

## Phase 2: Core Functionality

---

### Task 6: Equipment Edit Mode

**Files:**
- Modify: `src/app/(app)/equipment/[id]/page.tsx`
- Modify: `src/components/equipment/equipment-form.tsx`

- [ ] **Step 1: Update equipment detail page to conditionally render edit form**

When `searchParams.edit=1` is present, render `EquipmentForm` with the equipment data instead of the tabs. Keep the barcode and QR cards below.

Read the current page file and modify it. The page is currently an async server component. Add a `searchParams` prop and conditionally render:

```tsx
export default async function EquipmentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ edit?: string }>
}) {
  const { id } = await params
  const { edit } = await searchParams
  const equipment = await getEquipmentById(id)

  if (!equipment) notFound()

  const isEditing = edit === "1"

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/equipment" className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}>
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight">
              {isEditing ? "Edit Equipment" : equipment.name}
            </h2>
            {!isEditing && <StatusBadge status={equipment.status} />}
          </div>
          <p className="text-sm text-gray-500">Tag: {equipment.tag_number}</p>
        </div>
        <div className="ml-auto">
          {isEditing ? (
            <Link href={`/equipment/${id}`} className={cn(buttonVariants({ variant: "outline" }))}>
              Cancel
            </Link>
          ) : (
            <Link href={`/equipment/${id}?edit=1`} className={cn(buttonVariants({ variant: "outline" }))}>
              Edit
            </Link>
          )}
        </div>
      </div>

      {isEditing ? (
        <div className="rounded-lg border bg-white p-6">
          <EquipmentForm equipment={equipment} />
        </div>
      ) : (
        <Tabs defaultValue="info" className="w-full">
          ...existing tabs content...
        </Tabs>
      )}

      {/* Barcode and QR cards always shown */}
      <Card>...barcode...</Card>
      <Card>...QR label...</Card>
    </div>
  )
}
```

- [ ] **Step 2: Verify EquipmentForm already supports edit mode**

The form already has `equipment?: Equipment` prop and uses `equipment ? updateEquipment.bind(null, equipment.id) : createEquipment`. Verify this still works.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/equipment/\[id\]/page.tsx
git commit -m "feat: add equipment edit mode on detail page"
```

---

### Task 7: PM Schedule Detail Page

**Files:**
- Create: `src/app/(app)/pm-schedules/[id]/page.tsx`
- Create: `src/components/pm-schedules/pm-detail-card.tsx`

- [ ] **Step 1: Create PM detail card component**

```tsx
"use client"

import { useSearchParams } from "next/navigation"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { StatusBadge } from "@/components/shared/status-badge"
import { getPMStatus } from "@/lib/utils/format"
import { formatDate } from "@/lib/utils/format"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { AlertCircle } from "lucide-react"
import type { PMSchedule } from "@/lib/types"

interface Props {
  pmSchedule: PMSchedule
}

export function PMDetailCard({ pmSchedule }: Props) {
  const searchParams = useSearchParams()
  const error = searchParams.get("error")
  const [checklist, setChecklist] = useState(pmSchedule.checklist || [])
  const supabase = createClient()

  const status = getPMStatus(pmSchedule)

  const toggleItem = async (index: number) => {
    const updated = [...checklist]
    updated[index] = { ...updated[index], completed: !updated[index].completed }
    setChecklist(updated)
    await supabase
      .schema("ebiomed")
      .from("pm_schedules")
      .update({ checklist: updated })
      .eq("id", pmSchedule.id)
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-sm font-medium text-gray-500">Equipment</p>
          <p>{pmSchedule.equipment?.name} ({pmSchedule.equipment?.tag_number})</p>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500">Frequency</p>
          <p>{pmSchedule.frequency_days} days</p>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500">Last Completed</p>
          <p>{pmSchedule.last_completed ? formatDate(pmSchedule.last_completed) : "Never"}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500">Next Due</p>
          <p>{pmSchedule.next_due ? formatDate(pmSchedule.next_due) : "—"}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500">Status</p>
          <StatusBadge status={status} />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500">Active</p>
          <p>{pmSchedule.active ? "Yes" : "No"}</p>
        </div>
      </div>

      {pmSchedule.description && (
        <div>
          <p className="text-sm font-medium text-gray-500">Description</p>
          <p className="whitespace-pre-wrap">{pmSchedule.description}</p>
        </div>
      )}

      {checklist.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-500">Checklist</p>
          <div className="space-y-2">
            {checklist.map((item, index) => (
              <div key={item.id || index} className="flex items-center gap-2">
                <Checkbox
                  id={`check-${index}`}
                  checked={item.completed}
                  onCheckedChange={() => toggleItem(index)}
                />
                <Label htmlFor={`check-${index}`} className={item.completed ? "line-through text-gray-400" : ""}>
                  {item.text}
                </Label>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create PM detail page**

```tsx
import Link from "next/link"
import { notFound } from "next/navigation"
import { getPMScheduleById } from "@/lib/actions/pm-schedules"
import { PMDetailCard } from "@/components/pm-schedules/pm-detail-card"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ChevronLeft } from "lucide-react"

export default async function PMScheduleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const pm = await getPMScheduleById(id)

  if (!pm) notFound()

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/pm-schedules" className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}>
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h2 className="text-2xl font-bold tracking-tight">PM Schedule Detail</h2>
      </div>
      <div className="rounded-lg border bg-white p-6">
        <PMDetailCard pmSchedule={pm} />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Add Checkbox export to shadcn components if missing**

If `src/components/ui/checkbox.tsx` doesn't exist, install it:

```bash
PATH="/opt/homebrew/bin:$PATH" npx shadcn add checkbox
```

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/pm-schedules/\[id\]/page.tsx src/components/pm-schedules/pm-detail-card.tsx
git commit -m "feat: add PM schedule detail page with checklist"
```

---

### Task 8: PM Schedule Create Page

**Files:**
- Create: `src/app/(app)/pm-schedules/new/page.tsx`
- Create: `src/components/pm-schedules/pm-form.tsx`

- [ ] **Step 1: Create PM form component**

```tsx
"use client"

import { useSearchParams } from "next/navigation"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { createPMSchedule } from "@/lib/actions/pm-schedules"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { AlertCircle } from "lucide-react"
import type { Equipment } from "@/lib/types"

export function PMScheduleForm() {
  const searchParams = useSearchParams()
  const error = searchParams.get("error")
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const supabase = createClient()

  useEffect(() => {
    supabase
      .from("equipment")
      .select("*")
      .neq("status", "retired")
      .order("name")
      .then(({ data }) => setEquipment((data || []) as Equipment[]))
  }, [supabase])

  return (
    <form action={createPMSchedule} className="space-y-6">
      {error && (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <div>
        <Label htmlFor="equipment_id">Equipment *</Label>
        <Select name="equipment_id">
          <SelectTrigger><SelectValue placeholder="Select equipment..." /></SelectTrigger>
          <SelectContent>
            {equipment.map((eq) => (
              <SelectItem key={eq.id} value={eq.id}>
                {eq.tag_number} — {eq.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="frequency_days">Frequency (days) *</Label>
          <Input id="frequency_days" name="frequency_days" type="number" min={1} required />
        </div>
        <div>
          <Label htmlFor="active">Active</Label>
          <Select name="active" defaultValue="true">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="true">Yes</SelectItem>
              <SelectItem value="false">No</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" rows={3} />
      </div>

      <div>
        <Label htmlFor="checklist">Checklist Items (one per line)</Label>
        <Textarea
          id="checklist"
          name="checklist"
          rows={4}
          placeholder="Inspect power cord&#10;Check calibration&#10;Clean filters"
        />
      </div>

      <div className="flex gap-3">
        <Button type="submit">Create PM Schedule</Button>
        <Button variant="outline" type="button" onClick={() => history.back()}>Cancel</Button>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: Create PM create page**

```tsx
import Link from "next/link"
import { PMScheduleForm } from "@/components/pm-schedules/pm-form"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ChevronLeft } from "lucide-react"

export default function NewPMSchedulePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/pm-schedules" className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}>
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h2 className="text-2xl font-bold tracking-tight">New PM Schedule</h2>
      </div>
      <div className="rounded-lg border bg-white p-6">
        <PMScheduleForm />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Update `createPMSchedule` action to handle checklist input**

Modify `src/lib/actions/pm-schedules.ts` to parse the newline-separated checklist into JSON array:

```ts
// In createPMSchedule, before insert:
const checklistRaw = (formData.get("checklist") as string) || ""
const checklist = checklistRaw
  .split("\n")
  .map((text, index) => ({
    id: `check-${index}`,
    text: text.trim(),
    completed: false,
  }))
  .filter((item) => item.text.length > 0)
```

Pass `checklist` into the insert.

- [ ] **Step 4: Add "New PM Schedule" button to PM list page**

Modify `src/app/(app)/pm-schedules/page.tsx` to add a button linking to `/pm-schedules/new`.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/pm-schedules/new/page.tsx src/components/pm-schedules/pm-form.tsx src/lib/actions/pm-schedules.ts src/app/\(app\)/pm-schedules/page.tsx
git commit -m "feat: add PM schedule creation page with checklist support"
```

---

### Task 9: Wire `consumeParts` into WO Detail

**Files:**
- Create: `src/components/work-orders/parts-usage-form.tsx`
- Modify: `src/components/work-orders/wo-detail-card.tsx`
- Modify: `src/lib/actions/work-orders.ts`

- [ ] **Step 1: Create parts usage form component**

```tsx
"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { consumeParts } from "@/lib/actions/parts"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import type { Part } from "@/lib/types"

interface Props {
  workOrderId: string
}

export function PartsUsageForm({ workOrderId }: Props) {
  const [parts, setParts] = useState<Part[]>([])
  const supabase = createClient()

  useEffect(() => {
    supabase
      .schema("ebiomed")
      .from("parts")
      .select("*")
      .order("name")
      .then(({ data }) => setParts((data || []) as Part[]))
  }, [supabase])

  return (
    <form action={consumeParts} className="space-y-4">
      <input type="hidden" name="work_order_id" value={workOrderId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="part_id">Part</Label>
          <Select name="part_id">
            <SelectTrigger><SelectValue placeholder="Select part..." /></SelectTrigger>
            <SelectContent>
              {parts.map((part) => (
                <SelectItem key={part.id} value={part.id}>
                  {part.name} ({part.quantity_on_hand} in stock)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="quantity_used">Quantity Used</Label>
          <Input id="quantity_used" name="quantity_used" type="number" min={1} required />
        </div>
      </div>
      <Button type="submit" size="sm">Log Parts Used</Button>
    </form>
  )
}
```

- [ ] **Step 2: Add `consumeParts` to WO detail card**

Insert `<PartsUsageForm workOrderId={workOrder.id} />` below the status update form, inside the `!isComplete` guard. Also add `import { PartsUsageForm } from "@/components/work-orders/parts-usage-form"`.

- [ ] **Step 3: Display parts used on WO detail**

Add a section that queries `parts_usage` joined with `parts` for the current WO and displays a table of consumed parts.

In `wo-detail-card.tsx`, add a `useEffect` to fetch parts usage:

```tsx
const [partsUsed, setPartsUsed] = useState<Array<{ part_name: string; quantity_used: number; used_at: string }>>([])

useEffect(() => {
  supabase
    .schema("ebiomed")
    .from("parts_usage")
    .select("quantity_used, used_at, part:part_id(name)")
    .eq("work_order_id", workOrder.id)
    .order("used_at", { ascending: false })
    .then(({ data }) => setPartsUsed((data || []) as any))
}, [workOrder.id, supabase])
```

Render a small table if `partsUsed.length > 0`.

- [ ] **Step 4: Commit**

```bash
git add src/components/work-orders/parts-usage-form.tsx src/components/work-orders/wo-detail-card.tsx
git commit -m "feat: wire parts consumption into work order detail"
```

---

## Phase 3: Business Rules & Reporting

---

### Task 10: Status Lifecycle Enforcement

**Files:**
- Modify: `src/lib/actions/work-orders.ts`

- [ ] **Step 1: Add status validation to `updateWorkOrderStatus`**

Before the Zod parse, fetch current status and enforce rules:

```ts
const { data: current } = await supabase
  .from("work_orders")
  .select("status")
  .eq("id", id)
  .single()

if (!current) return redirect(`/work-orders/${id}?error=Work order not found`)

const newStatus = raw.status as string

// Completed or cancelled = immutable
if (current.status === "completed" || current.status === "cancelled") {
  return redirect(`/work-orders/${id}?error=Cannot modify a completed or cancelled work order`)
}

// Prevent reopening
if ((current.status === "completed" || current.status === "cancelled") && newStatus !== current.status) {
  return redirect(`/work-orders/${id}?error=Cannot reopen a completed or cancelled work order`)
}

// Prevent invalid transitions (e.g., open → completed without in_progress)
const validTransitions: Record<string, string[]> = {
  open: ["in_progress", "on_hold", "cancelled"],
  in_progress: ["on_hold", "completed", "cancelled"],
  on_hold: ["in_progress", "cancelled"],
}

if (!validTransitions[current.status]?.includes(newStatus)) {
  return redirect(`/work-orders/${id}?error=Invalid status transition from ${current.status} to ${newStatus}`)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/actions/work-orders.ts
git commit -m "fix: enforce work order status lifecycle rules"
```

---

### Task 11: Retired Equipment Check on WO Create

**Files:**
- Modify: `src/lib/actions/work-orders.ts`

- [ ] **Step 1: Validate equipment status before insert**

```ts
const { data: equip } = await supabase
  .from("equipment")
  .select("status")
  .eq("id", parsed.data.equipment_id)
  .single()

if (equip?.status === "retired") {
  return redirect(`/work-orders/new?error=Cannot create work order for retired equipment`)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/actions/work-orders.ts
git commit -m "fix: block work order creation for retired equipment"
```

---

### Task 12: Downtime Calculation

**Files:**
- Modify: `src/lib/actions/work-orders.ts`

- [ ] **Step 1: Calculate downtime on completion**

In `updateWorkOrderStatus`, when status === "completed" and `started_at` exists:

```ts
if (parsed.data.status === "completed") {
  updateData.completed_at = new Date().toISOString()

  // Calculate downtime
  const { data: wo } = await supabase
    .from("work_orders")
    .select("started_at")
    .eq("id", id)
    .single()

  if (wo?.started_at) {
    const started = new Date(wo.started_at).getTime()
    const completed = new Date(updateData.completed_at as string).getTime()
    const minutes = Math.round((completed - started) / 60000)
    updateData.downtime_minutes = minutes
  }
}
```

- [ ] **Step 2: Display downtime on WO detail card**

Add to `wo-detail-card.tsx` grid:

```tsx
{workOrder.downtime_minutes !== null && (
  <div>
    <p className="text-sm font-medium text-gray-500">Downtime</p>
    <p>{workOrder.downtime_minutes} minutes</p>
  </div>
)}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/work-orders.ts src/components/work-orders/wo-detail-card.tsx
git commit -m "feat: calculate and display downtime on work order completion"
```

---

### Task 13: Date Filtering on Reports

**Files:**
- Modify: `src/app/(app)/reports/page.tsx`
- Modify: `src/components/reports/compliance-chart.tsx` (if needed)

- [ ] **Step 1: Add date range state and UI to reports page**

Convert the reports page to a client component with date range picker. Add two date inputs (from/to) that filter the "Work Orders This Month" section. Replace the hardcoded current-month filter with the selected range.

Use `useState` for `dateFrom` and `dateTo`, defaulting to the current month. Pass these as query params to the server fetch.

- [ ] **Step 2: Commit**

```bash
git add src/app/\(app\)/reports/page.tsx
git commit -m "feat: add date range filter to reports"
```

---

### Task 14: Parts Usage History on WO Detail

Already covered in Task 9 (display parts used table). If not fully implemented there, add the parts usage display section.

---

## Phase 4: UX & Polish

---

### Task 15: Role-Based Nav Hiding

**Files:**
- Modify: `src/components/layout/sidebar.tsx`
- Modify: `src/app/(app)/layout.tsx`

- [ ] **Step 1: Pass user role to layout**

In `src/app/(app)/layout.tsx`, fetch the current user and pass role to Sidebar and BottomNav.

- [ ] **Step 2: Conditionally hide nav items based on role**

In `sidebar.tsx`, accept a `role` prop and filter NAV_ITEMS. Viewers should not see Settings. Technicians should see all.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/sidebar.tsx src/app/\(app\)/layout.tsx
git commit -m "feat: hide nav items based on user role"
```

---

### Task 16: My Tasks in Bottom Nav

**Files:**
- Modify: `src/components/layout/bottom-nav.tsx`

- [ ] **Step 1: Add My Tasks to bottom nav**

Add `{ href: "/my-tasks", label: "Tasks", icon: ClipboardCheck }` to BOTTOM_ITEMS. Import `ClipboardCheck` from lucide-react.

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/bottom-nav.tsx
git commit -m "feat: add My Tasks to mobile bottom navigation"
```

---

### Task 17: Print Style Refinement

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Test and refine print styles**

Verify the `.print-only` overlay approach works correctly with the canvas QR code. If the canvas doesn't render in print preview, convert it to an image before print.

In `PrintLabelButton`, add a pre-print step:

```tsx
const handlePrint = () => {
  // Ensure canvas is rendered before print
  setTimeout(() => window.print(), 100)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/globals.css src/components/report/print-label-button.tsx
git commit -m "fix: refine QR label print styles"
```

---

## Summary

| Phase | Tasks | Goal |
|-------|-------|------|
| 1 | 1-5 | Lock down security |
| 2 | 6-9 | Fill missing core pages |
| 3 | 10-14 | Enforce business rules |
| 4 | 15-17 | Polish UX |

**After Phase 1:** App is safe to deploy (auth, schema, RLS fixed).
**After Phase 2:** Core CMMS is functionally complete.
**After Phase 3:** Business rules prevent bad data.
**After Phase 4:** Good user experience on all devices.
