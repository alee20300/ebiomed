import { redirect } from "next/navigation"
import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/lib/actions/profiles"
import { getAllDepartments } from "@/lib/actions/departments"
import { getAllTemplates } from "@/lib/actions/checklist"
import { createEquipment, getEquipment } from "@/lib/actions/equipment"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { FileSpreadsheet, KeyRound, UserPlus, Trash2, Settings2, Users, Building2, ClipboardCheck, Wrench } from "lucide-react"
import { getProfiles, signup } from "@/lib/actions/profiles"
import { ViewerDepartmentsDialog } from "@/components/settings/viewer-departments-dialog"
import { ChecklistTemplatesTab } from "@/components/settings/checklist-templates-tab"
import { getAppSetting } from "@/lib/actions/settings"
import { CallLogToggle } from "@/components/settings/call-log-toggle"
import { ExpenseToggle } from "@/components/settings/expense-toggle"
import { commitImportBatch, previewImport, rollbackImportBatch } from "@/lib/actions/imports"
import { getPermissionAdminData, savePermissionGrant } from "@/lib/actions/permissions"
import { IMPORT_TEMPLATES } from "@/lib/imports/templates"
import { bulkUpdateEquipment } from "@/lib/actions/bulk-updates"
import type { Profile } from "@/lib/types"
import { StatusBadge } from "@/components/shared/status-badge"
import Link from "next/link"

async function UsersList() {
  const supabase = await createClient()
  const { data } = await supabase
    .schema("ebiomed")
    .from("profiles")
    .select("*")
    .order("full_name")

  const profiles = (data || []) as Profile[]
  const departments = await getAllDepartments()

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
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
              <Button type="submit" className="w-full">Create User</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

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
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">No users found.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
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
        <div className="flex justify-end">
          <form action={addDepartment} className="flex gap-2">
            <Input name="name" placeholder="New department name..." required maxLength={100} />
            <Button type="submit" variant="secondary">Add</Button>
          </form>
        </div>
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
                      <button type="submit" className="text-danger-strong hover:text-danger-strong">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </form>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {departments.length === 0 && (
              <TableRow>
                <TableCell colSpan={isAdmin ? 2 : 1} className="text-center text-muted-foreground py-8">
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

async function ChecklistTab() {
  const templates = await getAllTemplates()
  return <ChecklistTemplatesTab initialTemplates={templates} />
}

async function EquipmentTab() {
  const equipment = await getEquipment()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{equipment.length} equipment registered</p>
        <Dialog>
          <DialogTrigger className={cn(buttonVariants({}))}>
            <UserPlus className="mr-2 h-4 w-4" />
            Add Equipment
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add New Equipment</DialogTitle>
            </DialogHeader>
            <form action={createEquipment} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="tag_number">Tag Number *</Label>
                  <Input id="tag_number" name="tag_number" required />
                </div>
                <div>
                  <Label htmlFor="name">Name *</Label>
                  <Input id="name" name="name" required />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="serial_number">Serial Number</Label>
                  <Input id="serial_number" name="serial_number" />
                </div>
                <div>
                  <Label htmlFor="model">Model</Label>
                  <Input id="model" name="model" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="manufacturer">Manufacturer</Label>
                  <Input id="manufacturer" name="manufacturer" />
                </div>
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Input id="category" name="category" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="department">Department</Label>
                  <Input id="department" name="department" />
                </div>
                <div>
                  <Label htmlFor="location">Location</Label>
                  <Input id="location" name="location" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="install_date">Install Date</Label>
                  <Input id="install_date" name="install_date" type="date" />
                </div>
                <div>
                  <Label htmlFor="warranty_expiry">Warranty Expiry</Label>
                  <Input id="warranty_expiry" name="warranty_expiry" type="date" />
                </div>
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Input id="notes" name="notes" />
              </div>
              <Button type="submit" className="w-full">Create Equipment</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {equipment.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No equipment registered yet.</p>
      ) : (
        <div className="rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tag</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {equipment.map((eq) => (
                <TableRow key={eq.id}>
                  <TableCell className="font-mono text-xs">{eq.tag_number}</TableCell>
                  <TableCell className="font-medium">
                    <Link href={`/equipment/${eq.id}`} className="text-primary hover:underline">
                      {eq.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{eq.department || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{eq.location || "—"}</TableCell>
                  <TableCell><StatusBadge status={eq.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

async function GeneralTab() {
  const expenseTracking = await getAppSetting("expense_tracking_enabled")
  const isExpenseEnabled = expenseTracking === true

  const callLogWorkflow = await getAppSetting("call_log_workflow_enabled")
  const isCallLogEnabled = callLogWorkflow === true

  return (
    <div className="space-y-4">
      <ExpenseToggle initialEnabled={isExpenseEnabled} />
      <CallLogToggle initialEnabled={isCallLogEnabled} />
      <div className="rounded-lg border p-4">
        <h3 className="font-medium">Enterprise Exports</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/api/reports/export?report=inventory&format=csv" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Inventory CSV
          </Link>
          <Link href="/api/reports/export?report=inventory&format=xlsx" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Inventory XLSX
          </Link>
          <Link href="/api/v1/power-bi/export" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Power BI JSON
          </Link>
          <Link href="/docs/runbooks/backup-restore.md" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Backup Runbook
          </Link>
        </div>
      </div>
    </div>
  )
}

async function PermissionsTab() {
  const [profiles, permissionData] = await Promise.all([getProfiles(), getPermissionAdminData()])
  return (
    <div className="space-y-6">
      <form action={savePermissionGrant} className="grid gap-3 rounded-lg border p-4 md:grid-cols-6">
        <div>
          <Label htmlFor="permission-profile">User</Label>
          <select id="permission-profile" name="profile_id" className="h-10 w-full rounded-md border bg-background px-3 text-sm" required>
            <option value="">Select user</option>
            {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name}</option>)}
          </select>
        </div>
        <div><Label htmlFor="permission-action">Action</Label><Input id="permission-action" name="action" placeholder="read" required /></div>
        <div><Label htmlFor="permission-resource">Resource</Label><Input id="permission-resource" name="resource" placeholder="inventory" required /></div>
        <div>
          <Label htmlFor="permission-scope">Scope</Label>
          <select id="permission-scope" name="scope_type" className="h-10 w-full rounded-md border bg-background px-3 text-sm" defaultValue="global">
            <option value="global">Global</option>
            <option value="site">Site</option>
            <option value="department">Department</option>
            <option value="building">Building</option>
            <option value="floor">Floor</option>
            <option value="room">Room</option>
          </select>
        </div>
        <div><Label htmlFor="permission-scope-id">Scope ID</Label><Input id="permission-scope-id" name="scope_id" /></div>
        <div><Label htmlFor="permission-reason">Reason</Label><Input id="permission-reason" name="reason" required minLength={5} /></div>
        <Button type="submit" className="md:col-span-6">Save Permission</Button>
      </form>

      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Permission</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Granted</TableHead>
              <TableHead>Reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {permissionData.grants.map((grant) => (
              <TableRow key={grant.id}>
                <TableCell>{grant.profile?.full_name || grant.profile_id}</TableCell>
                <TableCell>{grant.action}:{grant.resource}</TableCell>
                <TableCell>{grant.scope_type}{grant.scope_id ? `:${grant.scope_id}` : ""}</TableCell>
                <TableCell>{grant.granted ? "Yes" : "No"}</TableCell>
                <TableCell>{grant.reason}</TableCell>
              </TableRow>
            ))}
            {permissionData.grants.length === 0 && (
              <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No explicit permission grants.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Change</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {permissionData.audit.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell>{entry.profile?.full_name || entry.profile_id}</TableCell>
                <TableCell>{entry.action}:{entry.resource} {String(entry.old_granted)} → {String(entry.new_granted)}</TableCell>
                <TableCell>{entry.reason}</TableCell>
                <TableCell>{entry.changed_at.slice(0, 10)}</TableCell>
              </TableRow>
            ))}
            {permissionData.audit.length === 0 && (
              <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">No permission audit entries.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

async function ImportsTab({ batchId }: { batchId?: string }) {
  const supabase = await createClient()
  const [{ data: batches }, profiles] = await Promise.all([
    supabase
      .schema("ebiomed")
      .from("import_batches")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10),
    getProfiles(),
  ])
  const selected = batchId ? batches?.find((batch) => batch.id === batchId) : batches?.[0]

  return (
    <div className="space-y-6">
      <form action={previewImport} className="grid gap-3 rounded-lg border p-4 md:grid-cols-[220px_1fr_auto]">
        <div>
          <Label htmlFor="template">Template</Label>
          <select id="template" name="template" className="h-10 w-full rounded-md border bg-background px-3 text-sm">
            {Object.keys(IMPORT_TEMPLATES).map((template) => <option key={template} value={template}>{template}</option>)}
          </select>
        </div>
        <div><Label htmlFor="file">CSV/XLSX CSV Export</Label><Input id="file" name="file" type="file" accept=".csv,.xlsx" required /></div>
        <div className="flex items-end"><Button type="submit">Preview Import</Button></div>
      </form>

      <div className="rounded-lg border bg-white p-4">
        <h3 className="font-medium">Templates</h3>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {Object.entries(IMPORT_TEMPLATES).map(([template, headers]) => (
            <div key={template} className="rounded-md border p-3">
              <div className="font-medium capitalize">{template}</div>
              <div className="mt-1 text-xs text-muted-foreground">{headers.join(", ")}</div>
            </div>
          ))}
        </div>
      </div>

      {selected && (
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">{selected.filename || selected.template}</h3>
              <p className="text-sm text-muted-foreground">
                {selected.valid_rows}/{selected.total_rows} valid · {selected.duplicate_rows} duplicates · {selected.error_rows} errors · {selected.status}
              </p>
            </div>
            {selected.status === "previewed" && (
              <div className="flex gap-2">
                <form action={commitImportBatch}>
                  <input type="hidden" name="id" value={selected.id} />
                  <Button type="submit" size="sm">Commit</Button>
                </form>
                <form action={rollbackImportBatch}>
                  <input type="hidden" name="id" value={selected.id} />
                  <Button type="submit" variant="outline" size="sm">Rollback</Button>
                </form>
              </div>
            )}
          </div>
          <pre className="mt-3 max-h-72 overflow-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify({
            errors: selected.errors,
            duplicates: selected.duplicate_matches,
            preview: selected.preview,
          }, null, 2)}</pre>
        </div>
      )}

      <form action={bulkUpdateEquipment} className="grid gap-3 rounded-lg border p-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <Label htmlFor="tag_numbers">Equipment Tags</Label>
          <textarea
            id="tag_numbers"
            name="tag_numbers"
            className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="BM-001, BM-002"
            required
          />
        </div>
        <div><Label htmlFor="bulk-department">Department</Label><Input id="bulk-department" name="department" /></div>
        <div><Label htmlFor="bulk-location">Location</Label><Input id="bulk-location" name="location" /></div>
        <div>
          <Label htmlFor="bulk-status">Status</Label>
          <select id="bulk-status" name="status" className="h-10 w-full rounded-md border bg-background px-3 text-sm">
            <option value="">No status change</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="under_repair">Under Repair</option>
            <option value="retired">Retired</option>
          </select>
        </div>
        <div>
          <Label htmlFor="assigned_pm">Assigned PM</Label>
          <select id="assigned_pm" name="assigned_pm" className="h-10 w-full rounded-md border bg-background px-3 text-sm">
            <option value="">No PM owner change</option>
            {profiles.filter((profile) => profile.role !== "viewer").map((profile) => (
              <option key={profile.id} value={profile.id}>{profile.full_name}</option>
            ))}
          </select>
        </div>
        <Button type="submit" className="md:col-span-2">Apply Bulk Update</Button>
      </form>
    </div>
  )
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ import_batch?: string }>
}) {
  const user = await getCurrentUser()
  if (user?.role === "viewer") redirect("/dashboard")

  const params = await searchParams

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">Settings</h2>

      <Tabs defaultValue="general" className="w-full min-w-0">
        <div className="overflow-x-auto pb-1">
        <TabsList className="min-w-max">
          <TabsTrigger value="general">
            <Settings2 className="mr-1.5 h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="users">
            <Users className="mr-1.5 h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="departments">
            <Building2 className="mr-1.5 h-4 w-4" />
            Departments
          </TabsTrigger>
          <TabsTrigger value="checklists">
            <ClipboardCheck className="mr-1.5 h-4 w-4" />
            Checklists
          </TabsTrigger>
          <TabsTrigger value="equipment">
            <Wrench className="mr-1.5 h-4 w-4" />
            Equipment
          </TabsTrigger>
          <TabsTrigger value="permissions">
            <KeyRound className="mr-1.5 h-4 w-4" />
            Permissions
          </TabsTrigger>
          <TabsTrigger value="imports">
            <FileSpreadsheet className="mr-1.5 h-4 w-4" />
            Imports
          </TabsTrigger>
        </TabsList>
        </div>

        <TabsContent value="general" className="rounded-lg border bg-white p-4 sm:p-6">
          <Suspense fallback={<Skeleton className="h-32 w-full" />}>
            <GeneralTab />
          </Suspense>
        </TabsContent>

        <TabsContent value="users" className="rounded-lg border bg-white p-4 sm:p-6">
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <UsersList />
          </Suspense>
        </TabsContent>

        <TabsContent value="departments" className="rounded-lg border bg-white p-4 sm:p-6">
          <Suspense fallback={<Skeleton className="h-32 w-full" />}>
            <DepartmentsList />
          </Suspense>
        </TabsContent>

        <TabsContent value="checklists" className="rounded-lg border bg-white p-4 sm:p-6">
          <Suspense fallback={<Skeleton className="h-32 w-full" />}>
            <ChecklistTab />
          </Suspense>
        </TabsContent>

        <TabsContent value="equipment" className="rounded-lg border bg-white p-4 sm:p-6">
          <Suspense fallback={<Skeleton className="h-32 w-full" />}>
            <EquipmentTab />
          </Suspense>
        </TabsContent>

        <TabsContent value="permissions" className="rounded-lg border bg-white p-4 sm:p-6">
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <PermissionsTab />
          </Suspense>
        </TabsContent>

        <TabsContent value="imports" className="rounded-lg border bg-white p-4 sm:p-6">
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <ImportsTab batchId={params.import_batch} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  )
}
