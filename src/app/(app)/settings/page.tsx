import { redirect } from "next/navigation"
import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/lib/actions/profiles"
import { getAllDepartments } from "@/lib/actions/departments"
import { getAllTemplates } from "@/lib/actions/checklist"
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
import { UserPlus, Trash2, Settings2, Users, Building2, ClipboardCheck } from "lucide-react"
import { signup } from "@/lib/actions/profiles"
import { ViewerDepartmentsDialog } from "@/components/settings/viewer-departments-dialog"
import { ChecklistTemplatesTab } from "@/components/settings/checklist-templates-tab"
import type { Profile } from "@/lib/types"

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

export default async function SettingsPage() {
  const user = await getCurrentUser()
  if (user?.role === "viewer") redirect("/dashboard")

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">Settings</h2>

      <Tabs defaultValue="users" className="w-full">
        <TabsList>
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
        </TabsList>

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
      </Tabs>
    </div>
  )
}
