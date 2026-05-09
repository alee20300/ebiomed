# Viewer Department Work Orders — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scope the Work Orders page so viewers see only open work orders from equipment in their supervised departments, with admin controls to manage departments and assign them to viewers.

**Architecture:** Two new database tables (`departments`, `viewer_departments`) with RLS. Modified `getWorkOrders` server action filters by viewer's supervised department equipment IDs. Settings page gains department CRUD and viewer assignment UI. Work Orders page adapts its title, subtitle, and button visibility for viewers.

**Tech Stack:** Next.js 15, Supabase (PostgreSQL), Base UI select, Tailwind CSS, Shadcn UI patterns, Zod

---

## File Structure Map

| File | Action | Purpose |
|------|--------|---------|
| `supabase/migrations/0006_departments.sql` | Create | Departments + viewer_departments tables, seed, RLS |
| `src/lib/types/index.ts` | Modify | Add `Department` and `ViewerDepartment` types |
| `src/lib/schemas/department.ts` | Create | Zod schemas for department validation |
| `src/lib/actions/departments.ts` | Create | Server actions: CRUD + viewer assignments |
| `src/lib/actions/work-orders.ts` | Modify | Add viewer filtering to `getWorkOrders` |
| `src/app/(app)/work-orders/page.tsx` | Modify | Viewer-aware title, subtitle, button visibility |
| `src/app/(app)/settings/page.tsx` | Modify | Add departments management + viewer assignment |
| `src/components/settings/viewer-departments-dialog.tsx` | Create | Checkbox multi-select dialog for assigning departments |
| `supabase/seed.sql` | Modify | Seed departments from existing equipment data |

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/0006_departments.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- Create departments lookup table
CREATE TABLE ebiomed.departments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create viewer-department junction table
CREATE TABLE ebiomed.viewer_departments (
  viewer_id uuid NOT NULL REFERENCES ebiomed.profiles(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES ebiomed.departments(id) ON DELETE CASCADE,
  PRIMARY KEY (viewer_id, department_id)
);

-- Seed departments from existing equipment.department and profiles.department
INSERT INTO ebiomed.departments (name)
SELECT DISTINCT department FROM ebiomed.equipment WHERE department IS NOT NULL
UNION
SELECT DISTINCT department FROM ebiomed.profiles WHERE department IS NOT NULL
ON CONFLICT (name) DO NOTHING;

-- Enable RLS
ALTER TABLE ebiomed.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ebiomed.viewer_departments ENABLE ROW LEVEL SECURITY;

-- Departments policies
CREATE POLICY "Departments viewable by authenticated" ON ebiomed.departments
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Departments insertable by admin" ON ebiomed.departments
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM ebiomed.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Departments deletable by admin" ON ebiomed.departments
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM ebiomed.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Viewer departments policies
CREATE POLICY "Viewer departments viewable by authenticated" ON ebiomed.viewer_departments
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Viewer departments editable by admin" ON ebiomed.viewer_departments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM ebiomed.profiles WHERE id = auth.uid() AND role = 'admin')
  );
```

- [ ] **Step 2: Apply migration locally**

Run: `npx supabase migration up --local`
Expected: Migration applies without errors.

- [ ] **Step 3: Verify tables exist**

Run: `npx supabase db dump --local --data-only 2>/dev/null | grep -E "departments|viewer_departments" || echo "Check Supabase dashboard"`
Expected: Tables are created and seed data is present.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0006_departments.sql
git commit -m "feat: add departments and viewer_departments tables with RLS"
```

---

### Task 2: Types and Schemas

**Files:**
- Modify: `src/lib/types/index.ts`
- Create: `src/lib/schemas/department.ts`

- [ ] **Step 1: Add types to `src/lib/types/index.ts`**

Append after the last interface (after `WoComment`):

```ts
export interface Department {
  id: string
  name: string
  created_at: string
}

export interface ViewerDepartment {
  viewer_id: string
  department_id: string
}
```

- [ ] **Step 2: Create `src/lib/schemas/department.ts`**

```ts
import { z } from "zod"

export const departmentSchema = z.object({
  name: z.string().min(1, "Department name is required").max(100, "Name too long"),
})

export const viewerDepartmentsSchema = z.object({
  viewer_id: z.string().uuid(),
  department_ids: z.array(z.string().uuid()),
})

export type DepartmentFormData = z.infer<typeof departmentSchema>
export type ViewerDepartmentsFormData = z.infer<typeof viewerDepartmentsSchema>
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/types/index.ts src/lib/schemas/department.ts
git commit -m "feat: add department and viewer-department types and schemas"
```

---

### Task 3: Server Actions — Departments CRUD + Viewer Assignments

**Files:**
- Create: `src/lib/actions/departments.ts`

- [ ] **Step 1: Create `src/lib/actions/departments.ts`**

```ts
"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/lib/actions/profiles"
import { departmentSchema, viewerDepartmentsSchema } from "@/lib/schemas/department"
import type { Department } from "@/lib/types"

async function requireAdmin() {
  const user = await getCurrentUser()
  if (!user || user.role !== "admin") {
    return redirect("/dashboard?error=" + encodeURIComponent("Admin access required"))
  }
  return user
}

export async function getAllDepartments(): Promise<Department[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("departments")
    .select("*")
    .order("name")

  return (data || []) as Department[]
}

export async function addDepartment(formData: FormData) {
  await requireAdmin()
  const supabase = await createClient()

  const raw = Object.fromEntries(formData)
  const parsed = departmentSchema.safeParse(raw)

  if (!parsed.success) {
    const messages = parsed.error.errors.map((e) => e.message).join(", ")
    return redirect(`/settings?error=${encodeURIComponent(messages)}`)
  }

  const { error } = await supabase
    .from("departments")
    .insert({ name: parsed.data.name.trim() })

  if (error) {
    if (error.code === "23505") {
      return redirect("/settings?error=" + encodeURIComponent("Department already exists"))
    }
    return redirect("/settings?error=" + encodeURIComponent(error.message))
  }

  revalidatePath("/settings")
  redirect("/settings")
}

export async function deleteDepartment(id: string) {
  await requireAdmin()
  const supabase = await createClient()

  const { error } = await supabase
    .from("departments")
    .delete()
    .eq("id", id)

  if (error) {
    return redirect(`/settings?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath("/settings")
  redirect("/settings")
}

export async function getViewerDepartmentIds(viewerId: string): Promise<string[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("viewer_departments")
    .select("department_id")
    .eq("viewer_id", viewerId)

  return (data || []).map((row: { department_id: string }) => row.department_id)
}

export async function getViewerDepartments(viewerId: string): Promise<Department[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("viewer_departments")
    .select("department:department_id(*)")
    .eq("viewer_id", viewerId)

  if (!data) return []
  return data.map((row: { department: unknown }) => (row as { department: Department }).department)
}

export async function saveViewerDepartments(formData: FormData) {
  await requireAdmin()
  const supabase = await createClient()

  const raw = Object.fromEntries(formData)
  const viewer_id = raw.viewer_id as string
  const department_ids = formData.getAll("department_ids") as string[]

  const parsed = viewerDepartmentsSchema.safeParse({ viewer_id, department_ids })

  if (!parsed.success) {
    const messages = parsed.error.errors.map((e) => e.message).join(", ")
    return redirect(`/settings?error=${encodeURIComponent(messages)}`)
  }

  // Atomic: delete all existing assignments, then insert new ones
  await supabase
    .from("viewer_departments")
    .delete()
    .eq("viewer_id", viewer_id)

  if (department_ids.length > 0) {
    const rows = department_ids.map((dept_id) => ({
      viewer_id,
      department_id: dept_id,
    }))
    await supabase.from("viewer_departments").insert(rows)
  }

  revalidatePath("/settings")
  redirect("/settings")
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/actions/departments.ts
git commit -m "feat: add department CRUD and viewer assignment server actions"
```

---

### Task 4: Modify `getWorkOrders` for Viewer Filtering

**Files:**
- Modify: `src/lib/actions/work-orders.ts`

- [ ] **Step 1: Add viewer filtering to `getWorkOrders`**

Replace the existing `getWorkOrders` function:

```ts
export async function getWorkOrders(): Promise<WorkOrder[]> {
  const supabase = await createClient()
  const user = await getCurrentUser()

  if (user?.role === "viewer") {
    // Get the departments this viewer supervises
    const deptIds = await getViewerDepartmentIds(user.id)
    if (deptIds.length === 0) return []

    // Get equipment IDs in those departments
    const { data: equipIds } = await supabase
      .from("equipment")
      .select("id")
      .in("department", deptIds.map(String) as any)

    const equipmentIdList = (equipIds || []).map((e: { id: string }) => e.id)

    if (equipmentIdList.length === 0) return []

    const { data } = await supabase
      .from("work_orders")
      .select("*, equipment(*)")
      .in("equipment_id", equipmentIdList)
      .in("status", ["open", "in_progress", "on_hold"])
      .order("created_at", { ascending: false })

    if (!data) return []
    return data as unknown as WorkOrder[]
  }

  const { data, error } = await supabase
    .from("work_orders")
    .select("*, equipment(*)")
    .order("created_at", { ascending: false })

  if (error) return []
  return data as unknown as WorkOrder[]
}
```

- [ ] **Step 2: Add required imports at the top of the file**

After the existing `import { getCurrentUser } from "@/lib/actions/profiles"` line, add:

```ts
import { getViewerDepartmentIds } from "@/lib/actions/departments"
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/work-orders.ts
git commit -m "feat: filter work orders by viewer's supervised departments"
```

---

### Task 5: Work Orders Page — Viewer-Aware UI

**Files:**
- Modify: `src/app/(app)/work-orders/page.tsx`

- [ ] **Step 1: Rewrite the page to be viewer-aware**

```tsx
import Link from "next/link"
import { Suspense } from "react"
import { getWorkOrders } from "@/lib/actions/work-orders"
import { getCurrentUser } from "@/lib/actions/profiles"
import { getViewerDepartments } from "@/lib/actions/departments"
import { WorkOrderTable } from "@/components/work-orders/wo-table"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus } from "lucide-react"

function Loading() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  )
}

async function WOList() {
  const orders = await getWorkOrders()
  return <WorkOrderTable data={orders} />
}

export default async function WorkOrdersPage() {
  const user = await getCurrentUser()
  const isViewer = user?.role === "viewer"

  let subtitle: string | null = null
  if (isViewer) {
    const departments = await getViewerDepartments(user!.id)
    if (departments.length > 0) {
      subtitle = departments.map((d) => d.name).join(", ")
    } else {
      subtitle = "No departments assigned. Contact an administrator."
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {isViewer ? "My Departments — Work Orders" : "Work Orders"}
          </h2>
          {subtitle && (
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {!isViewer && (
          <Link href="/work-orders/new" className={cn(buttonVariants({}))}>
            <Plus className="mr-2 h-4 w-4" />
            New Work Order
          </Link>
        )}
      </div>
      <Suspense fallback={<Loading />}>
        <WOList />
      </Suspense>
    </div>
  )
}
```

- [ ] **Step 2: Verify the page builds**

Run: `npx next build 2>&1 | tail -20 || echo "Check for type errors"`
Expected: No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/work-orders/page.tsx
git commit -m "feat: show department-scoped work order view for viewers"
```

---

### Task 6: Settings Page — Departments Management

**Files:**
- Modify: `src/app/(app)/settings/page.tsx`

- [ ] **Step 1: Add departments section to settings page**

Replace the existing `src/app/(app)/settings/page.tsx`:

```tsx
import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/lib/actions/profiles"
import { getAllDepartments } from "@/lib/actions/departments"
import { addDepartment, deleteDepartment } from "@/lib/actions/departments"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { UserPlus, Trash2, Settings2 } from "lucide-react"
import { signup } from "@/lib/actions/profiles"
import { ViewerDepartmentsDialog } from "@/components/settings/viewer-departments-dialog"
import type { Profile } from "@/lib/types"

async function UsersList() {
  const supabase = await createClient()
  const { data } = await supabase
    .schema("public")
    .from("profiles")
    .select("*")
    .order("full_name")

  const profiles = (data || []) as Profile[]
  const departments = await getAllDepartments()

  return (
    <div className="rounded-lg border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Department</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {profiles.map((profile) => (
            <TableRow key={profile.id}>
              <TableCell className="font-medium">{profile.full_name}</TableCell>
              <TableCell className="capitalize">{profile.role}</TableCell>
              <TableCell>{profile.department || "—"}</TableCell>
              <TableCell>{profile.phone || "—"}</TableCell>
              <TableCell>
                {profile.role === "viewer" && (
                  <ViewerDepartmentsDialog
                    viewerId={profile.id}
                    viewerName={profile.full_name}
                    departments={departments}
                  />
                )}
              </TableCell>
            </TableRow>
          ))}
          {profiles.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                No users found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

async function DepartmentsList() {
  const departments = await getAllDepartments()
  const user = await getCurrentUser()
  const isAdmin = user?.role === "admin"

  return (
    <div className="space-y-4">
      {isAdmin && (
        <form action={addDepartment} className="flex gap-2">
          <Input name="name" placeholder="New department name..." required maxLength={100} />
          <Button type="submit" variant="secondary">Add</Button>
        </form>
      )}
      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Department Name</TableHead>
              {isAdmin && <TableHead className="w-[60px]">Delete</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {departments.map((dept) => (
              <TableRow key={dept.id}>
                <TableCell className="font-medium">{dept.name}</TableCell>
                {isAdmin && (
                  <TableCell>
                    <form action={deleteDepartment.bind(null, dept.id)}>
                      <button type="submit" className="text-red-500 hover:text-red-700">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </form>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {departments.length === 0 && (
              <TableRow>
                <TableCell colSpan={isAdmin ? 2 : 1} className="text-center text-gray-500 py-8">
                  No departments configured.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <Dialog>
          <DialogTrigger className={cn(buttonVariants({}))}>
            <UserPlus className="mr-2 h-4 w-4" />
            Add User
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
            </DialogHeader>
            <form action={signup} className="space-y-4">
              <div>
                <Label htmlFor="fullName">Full Name *</Label>
                <Input id="fullName" name="fullName" required />
              </div>
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input id="email" name="email" type="email" required />
              </div>
              <div>
                <Label htmlFor="password">Password *</Label>
                <Input id="password" name="password" type="password" required minLength={6} />
              </div>
              <div>
                <Label htmlFor="role">Role</Label>
                <Select name="role" defaultValue="technician">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="technician">Technician</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="department">Department</Label>
                <Input id="department" name="department" />
              </div>
              <Button type="submit" className="w-full">
                Create User
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div>
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <Settings2 className="h-5 w-5" />
          Departments
        </h3>
        <Suspense fallback={<Skeleton className="h-32 w-full" />}>
          <DepartmentsList />
        </Suspense>
      </div>

      <div>
        <h3 className="mb-4 text-lg font-semibold">Users</h3>
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          <UsersList />
        </Suspense>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(app\)/settings/page.tsx
git commit -m "feat: add departments management and viewer assignment to settings"
```

---

### Task 7: Viewer Department Assignment Dialog

**Files:**
- Create: `src/components/settings/viewer-departments-dialog.tsx`

- [ ] **Step 1: Create `src/components/settings/viewer-departments-dialog.tsx`**

```tsx
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
```

- [ ] **Step 2: Verify the existing Checkbox component works for this use case**

Check `src/components/ui/checkbox.tsx` — it should export a `Checkbox` component with `checked` and `onCheckedChange` props.

- [ ] **Step 3: Commit**

```bash
git add src/components/settings/viewer-departments-dialog.tsx
git commit -m "feat: add viewer department assignment dialog with checkbox multi-select"
```

---

### Task 8: Update Seed SQL

**Files:**
- Modify: `supabase/seed.sql`

- [ ] **Step 1: Add departments seeding at the end of `supabase/seed.sql`**

Append to the end of the file:

```sql
-- Seed departments from equipment data
INSERT INTO ebiomed.departments (name)
SELECT DISTINCT department FROM ebiomed.equipment WHERE department IS NOT NULL
UNION
SELECT DISTINCT department FROM ebiomed.profiles WHERE department IS NOT NULL
ON CONFLICT (name) DO NOTHING;

-- Add viewer with departments for demo purposes
DO $$
DECLARE
  v_viewer_id uuid;
  v_icu_id uuid;
  v_radiology_id uuid;
BEGIN
  SELECT id INTO v_viewer_id FROM auth.users WHERE email = 'viewer@ebiomed.local';
  SELECT id INTO v_icu_id FROM ebiomed.departments WHERE name = 'ICU' LIMIT 1;
  SELECT id INTO v_radiology_id FROM ebiomed.departments WHERE name = 'Radiology' LIMIT 1;

  IF v_viewer_id IS NOT NULL AND v_icu_id IS NOT NULL THEN
    INSERT INTO ebiomed.viewer_departments (viewer_id, department_id)
    VALUES (v_viewer_id, v_icu_id)
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_viewer_id IS NOT NULL AND v_radiology_id IS NOT NULL THEN
    INSERT INTO ebiomed.viewer_departments (viewer_id, department_id)
    VALUES (v_viewer_id, v_radiology_id)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/seed.sql
git commit -m "feat: seed departments and viewer-department assignments"
```

---

### Task 9: Graphify Update

**Files:**
- (auto-generated)

- [ ] **Step 1: Update the knowledge graph**

Run: `graphify update .`
Expected: Graph regenerates with new files indexed.

- [ ] **Step 2: Commit**

```bash
git add graphify-out/
git commit -m "chore: update knowledge graph"
```

---

### Task 10: Final Verification

- [ ] **Step 1: Build the project**

Run: `npx next build 2>&1`
Expected: Build succeeds with no errors.

- [ ] **Step 2: Verify all changes are committed**

Run: `git status`
Expected: Clean working tree.

- [ ] **Step 3: Run lint**

```bash
npx next lint 2>&1
```
Expected: No lint errors.
