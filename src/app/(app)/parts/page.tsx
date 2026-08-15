import { redirect } from "next/navigation"
import { Suspense, type ComponentType, type ReactNode } from "react"
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
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { ArrowLeftRight, ClipboardCheck, MapPin, Plus, SlidersHorizontal } from "lucide-react"
import { createPart } from "@/lib/actions/parts"
import { getVendors } from "@/lib/actions/purchasing"
import {
  adjustStock,
  createStockLocation,
  getInventoryDashboard,
  recordCycleCount,
  transferStock,
} from "@/lib/actions/inventory"

function Loading() {
  return <div className="space-y-3">
    {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
  </div>
}

async function PartsList() {
  const [parts, inventory] = await Promise.all([getParts(), getInventoryDashboard()])
  return <PartsTable data={parts} inventory={inventory} />
}

function InventoryActionDialog({
  label,
  title,
  description,
  icon: Icon,
  primary = false,
  children,
}: {
  label: string
  title: string
  description: string
  icon: ComponentType<{ className?: string }>
  primary?: boolean
  children: ReactNode
}) {
  return (
    <Dialog>
      <DialogTrigger
        aria-label={label}
        title={label}
        className={cn(
          buttonVariants({ variant: primary ? "default" : "outline", size: "sm" }),
          "relative h-10 w-10 min-w-10 overflow-visible rounded-lg px-0"
        )}
      >
        <Icon className="h-4 w-4" />
        <span className="sr-only">{label}</span>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-9 left-1/2 z-20 -translate-x-1/2 rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background opacity-0 shadow-sm transition-opacity group-hover/button:opacity-100 group-focus-visible/button:opacity-100"
        >
          {label}
        </span>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}

export default async function PartsPage() {
  const user = await getCurrentUser()
  const vendors = await getVendors()
  const isViewer = user?.role === "viewer"

  if (isViewer) redirect("/dashboard")

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Parts Inventory</h2>
        {!isViewer && (
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <InventoryActionDialog
              label="Add part"
              title="Add New Part"
              description="Create a tracked inventory part with stock thresholds, valuation, vendor, and storage details."
              icon={Plus}
              primary
            >
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
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="max_threshold">Max Threshold</Label>
                    <Input id="max_threshold" name="max_threshold" type="number" min={0} />
                  </div>
                  <div>
                    <Label htmlFor="reorder_quantity">Reorder Qty</Label>
                    <Input id="reorder_quantity" name="reorder_quantity" type="number" min={1} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="valuation_method">Valuation Method</Label>
                  <select
                    id="valuation_method"
                    name="valuation_method"
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    defaultValue="standard_cost"
                  >
                    <option value="standard_cost">Standard Cost</option>
                    <option value="weighted_average">Weighted Average</option>
                    <option value="fifo">FIFO</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="unit_cost">Unit Cost ($)</Label>
                  <Input id="unit_cost" name="unit_cost" type="number" step="0.01" min={0} />
                </div>
                <div>
                  <Label htmlFor="preferred_vendor_id">Preferred Vendor</Label>
                  <select
                    id="preferred_vendor_id"
                    name="preferred_vendor_id"
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="">No preferred vendor</option>
                    {vendors.map((vendor) => (
                      <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="vendor_price">Vendor Price ($)</Label>
                    <Input id="vendor_price" name="vendor_price" type="number" step="0.01" min={0} />
                  </div>
                  <div>
                    <Label htmlFor="lead_time_days">Lead Time Days</Label>
                    <Input id="lead_time_days" name="lead_time_days" type="number" min={0} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="supplier">Supplier</Label>
                  <Input id="supplier" name="supplier" />
                </div>
                <div>
                  <Label htmlFor="location">Storage Location</Label>
                  <Input id="location" name="location" />
                </div>
                <div>
                  <Label htmlFor="bin_code">Bin</Label>
                  <Input id="bin_code" name="bin_code" />
                </div>
                <Button type="submit" className="w-full">
                  Create Part
                </Button>
              </form>
            </InventoryActionDialog>
            <InventoryActionDialog
              label="Add location"
              title="Add Stock Location"
              description="Create a site, room, or bin location used for inventory storage and stock movements."
              icon={MapPin}
            >
              <form action={createStockLocation} className="space-y-3">
                <div><Label htmlFor="code">Code</Label><Input id="code" name="code" required /></div>
                <div><Label htmlFor="location-name">Name</Label><Input id="location-name" name="name" required /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label htmlFor="site">Site</Label><Input id="site" name="site" /></div>
                  <div><Label htmlFor="room">Room</Label><Input id="room" name="room" /></div>
                </div>
                <Button type="submit" className="w-full">Create Location</Button>
              </form>
            </InventoryActionDialog>
            <InventoryActionDialog
              label="Adjust stock"
              title="Stock Adjustment"
              description="Record a controlled stock increase or decrease with location, bin, and reason."
              icon={SlidersHorizontal}
            >
              <form action={adjustStock} className="space-y-3">
                <PartSelect />
                <InventoryLocationSelect />
                <div><Label htmlFor="quantity_delta">Quantity Delta</Label><Input id="quantity_delta" name="quantity_delta" type="number" required /></div>
                <div><Label htmlFor="adjust-bin">Bin</Label><Input id="adjust-bin" name="bin_code" /></div>
                <div><Label htmlFor="adjust-reason">Reason</Label><Input id="adjust-reason" name="reason" required minLength={5} /></div>
                <Button type="submit" className="w-full">Record Adjustment</Button>
              </form>
            </InventoryActionDialog>
            <InventoryActionDialog
              label="Cycle count"
              title="Cycle Count"
              description="Capture expected versus counted quantity and preserve variance evidence."
              icon={ClipboardCheck}
            >
              <form action={recordCycleCount} className="space-y-3">
                <PartSelect />
                <InventoryLocationSelect />
                <div className="grid grid-cols-2 gap-3">
                  <div><Label htmlFor="expected_quantity">Expected</Label><Input id="expected_quantity" name="expected_quantity" type="number" min={0} required /></div>
                  <div><Label htmlFor="counted_quantity">Counted</Label><Input id="counted_quantity" name="counted_quantity" type="number" min={0} required /></div>
                </div>
                <div><Label htmlFor="count-bin">Bin</Label><Input id="count-bin" name="bin_code" /></div>
                <div><Label htmlFor="count-reason">Reason</Label><Input id="count-reason" name="reason" required minLength={5} /></div>
                <Button type="submit" className="w-full">Save Count</Button>
              </form>
            </InventoryActionDialog>
            <InventoryActionDialog
              label="Transfer stock"
              title="Transfer Stock"
              description="Move stock between locations and bins with a traceable transfer reason."
              icon={ArrowLeftRight}
            >
              <form action={transferStock} className="space-y-3">
                <PartSelect />
                <InventoryLocationSelect name="from_stock_location_id" label="From Location" />
                <InventoryLocationSelect name="to_stock_location_id" label="To Location" />
                <div><Label htmlFor="transfer-quantity">Quantity</Label><Input id="transfer-quantity" name="quantity" type="number" min={1} required /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label htmlFor="from_bin_code">From Bin</Label><Input id="from_bin_code" name="from_bin_code" /></div>
                  <div><Label htmlFor="to_bin_code">To Bin</Label><Input id="to_bin_code" name="to_bin_code" /></div>
                </div>
                <div><Label htmlFor="transfer-reason">Reason</Label><Input id="transfer-reason" name="reason" required minLength={5} /></div>
                <Button type="submit" className="w-full">Transfer</Button>
              </form>
            </InventoryActionDialog>
          </div>
        )}
      </div>
      <Suspense fallback={<Loading />}>
        <PartsList />
      </Suspense>
    </div>
  )
}

async function PartSelect() {
  const parts = await getParts()
  return (
    <div>
      <Label htmlFor="part_id">Part</Label>
      <select id="part_id" name="part_id" className="h-10 w-full rounded-md border bg-background px-3 text-sm" required>
        <option value="">Select part</option>
        {parts.map((part) => <option key={part.id} value={part.id}>{part.name}</option>)}
      </select>
    </div>
  )
}

async function InventoryLocationSelect({ name = "stock_location_id", label = "Location" }: { name?: string; label?: string }) {
  const inventory = await getInventoryDashboard()
  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      <select id={name} name={name} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
        <option value="">Default</option>
        {inventory.locations.map((location) => (
          <option key={location.id} value={location.id}>{location.name}</option>
        ))}
      </select>
    </div>
  )
}
