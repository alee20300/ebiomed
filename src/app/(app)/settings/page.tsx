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
import { UserPlus, Trash2, Settings2, Users, Building2, ClipboardCheck, Wrench } from "lucide-react"
import { signup } from "@/lib/actions/profiles"
import { ViewerDepartmentsDialog } from "@/components/settings/viewer-departments-dialog"
import { ChecklistTemplatesTab } from "@/components/settings/checklist-templates-tab"
import { getAppSetting } from "@/lib/actions/settings"
import { ExpenseToggle } from "@/components/settings/expense-toggle"
import type { Profile, Equipment } from "@/lib/types"
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
                <TableCell colSpan={5} className="text-center text-gray-500 py-8">No users found.</TableCell>
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

async function ChecklistTab() {
  const templates = await getAllTemplates()
  return <ChecklistTemplatesTab initialTemplates={templates} />
}

async function EquipmentTab() {
  const equipment = await getEquipment()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{equipment.length} equipment registered</p>
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
        <p className="py-8 text-center text-sm text-gray-500">No equipment registered yet.</p>
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
                  <TableCell className="text-sm text-gray-500">{eq.department || "—"}</TableCell>
                  <TableCell className="text-sm text-gray-500">{eq.location || "—"}</TableCell>
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
  const isEnabled = expenseTracking === true

  return (
    <div className="space-y-4">
      <ExpenseToggle initialEnabled={isEnabled} />
    </div>
  )
}

export default async function SettingsPage() {
  const user = await getCurrentUser()
  if (user?.role === "viewer") redirect("/dashboard")

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">Settings</h2>

      <Tabs defaultValue="general" className="w-full">
        <TabsList>
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
        </TabsList>

        <TabsContent value="general" className="rounded-lg border bg-white p-6">
          <Suspense fallback={<Skeleton className="h-32 w-full" />}>
            <GeneralTab />
          </Suspense>
        </TabsContent>

        <TabsContent value="users" className="rounded-lg border bg-white p-6">
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <UsersList />
          </Suspense>
        </TabsContent>

        <TabsContent value="departments" className="rounded-lg border bg-white p-6">
          <Suspense fallback={<Skeleton className="h-32 w-full" />}>
            <DepartmentsList />
          </Suspense>
        </TabsContent>

        <TabsContent value="checklists" className="rounded-lg border bg-white p-6">
          <Suspense fallback={<Skeleton className="h-32 w-full" />}>
            <ChecklistTab />
          </Suspense>
        </TabsContent>

        <TabsContent value="equipment" className="rounded-lg border bg-white p-6">
          <Suspense fallback={<Skeleton className="h-32 w-full" />}>
            <EquipmentTab />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  )
}
