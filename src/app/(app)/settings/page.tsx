import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
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
import { UserPlus } from "lucide-react"
import { signup } from "@/lib/actions/profiles"
import type { Profile } from "@/lib/types"

async function UsersList() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .order("full_name")

  const profiles = (data || []) as Profile[]

  return (
    <div className="rounded-lg border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Department</TableHead>
            <TableHead>Phone</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {profiles.map((profile) => (
            <TableRow key={profile.id}>
              <TableCell className="font-medium">{profile.full_name}</TableCell>
              <TableCell className="capitalize">{profile.role}</TableCell>
              <TableCell>{profile.department || "—"}</TableCell>
              <TableCell>{profile.phone || "—"}</TableCell>
            </TableRow>
          ))}
          {profiles.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-gray-500 py-8">
                No users found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
            </DialogHeader>
            <form className="space-y-4">
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
              <Button formAction={signup} type="submit" className="w-full">
                Create User
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <UsersList />
      </Suspense>
    </div>
  )
}
