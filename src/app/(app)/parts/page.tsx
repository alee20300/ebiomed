import { redirect } from "next/navigation"
import { Suspense } from "react"
import { getParts } from "@/lib/actions/parts"
import { getCurrentUser } from "@/lib/actions/profiles"
import { PartsTable } from "@/components/parts/parts-table"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Plus } from "lucide-react"
import { createPart } from "@/lib/actions/parts"

function Loading() {
  return <div className="space-y-3">
    {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
  </div>
}

async function PartsList() {
  const parts = await getParts()
  return <PartsTable data={parts} />
}

export default async function PartsPage() {
  const user = await getCurrentUser()
  const isViewer = user?.role === "viewer"

  if (isViewer) redirect("/dashboard")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Parts Inventory</h2>
        {!isViewer && (
          <Dialog>
            <DialogTrigger className={cn(buttonVariants({}))}>
              <Plus className="mr-2 h-4 w-4" />
              Add Part
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Part</DialogTitle>
              </DialogHeader>
              <form action={createPart} className="space-y-4">
                <div>
                  <Label htmlFor="name">Part Name *</Label>
                  <Input id="name" name="name" required />
                </div>
                <div>
                  <Label htmlFor="part_number">Part Number</Label>
                  <Input id="part_number" name="part_number" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="quantity_on_hand">Initial Quantity</Label>
                    <Input id="quantity_on_hand" name="quantity_on_hand" type="number" min={0} defaultValue={0} />
                  </div>
                  <div>
                    <Label htmlFor="min_threshold">Min Threshold</Label>
                    <Input id="min_threshold" name="min_threshold" type="number" min={0} defaultValue={5} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="unit_cost">Unit Cost ($)</Label>
                  <Input id="unit_cost" name="unit_cost" type="number" step="0.01" min={0} />
                </div>
                <div>
                  <Label htmlFor="supplier">Supplier</Label>
                  <Input id="supplier" name="supplier" />
                </div>
                <div>
                  <Label htmlFor="location">Storage Location</Label>
                  <Input id="location" name="location" />
                </div>
                <Button type="submit" className="w-full">
                  Create Part
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>
      <Suspense fallback={<Loading />}>
        <PartsList />
      </Suspense>
    </div>
  )
}
