"use client"

import { useState } from "react"
import {
  BarChart3,
  BellRing,
  ClipboardCheck,
  FilePlus2,
  FileText,
  Package,
  Plus,
  RefreshCw,
  Truck,
  UserPlus,
} from "lucide-react"
import {
  createContract,
  createPurchaseRequest,
  createVendor,
  recordVendorPerformanceEvent,
  refreshContractStatuses,
} from "@/lib/actions/purchasing"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  ContractsQueue,
  LowStockReorderQueue,
  PurchaseRequestsQueue,
  ReceivingQueue,
  VendorPerformanceQueue,
} from "@/components/purchasing/purchasing-queues"
import { KpiCard, type KpiTone } from "@/components/shared/kpi-card"
import type {
  Contract,
  Equipment,
  Part,
  PurchaseOrder,
  PurchaseRequest,
  ReorderSuggestion,
  Vendor,
  VendorPerformanceSummary,
} from "@/lib/types"

type PurchasingWorkspaceProps = {
  vendors: Vendor[]
  parts: Part[]
  reorderSuggestions: ReorderSuggestion[]
  purchaseRequests: PurchaseRequest[]
  purchaseOrders: PurchaseOrder[]
  contracts: Contract[]
  equipment: Equipment[]
  vendorPerformance: VendorPerformanceSummary[]
}

function money(value: number | null | undefined) {
  if (value == null) return "-"
  return `$${Number(value).toFixed(2)}`
}

function ActionDialog({
  label,
  title,
  description,
  icon: Icon,
  primary = false,
  iconOnly = false,
  className,
  children,
}: {
  label: string
  title: string
  description: string
  icon?: React.ComponentType<{ className?: string }>
  primary?: boolean
  iconOnly?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <Dialog>
      <DialogTrigger
        aria-label={iconOnly ? label : undefined}
        title={iconOnly ? label : undefined}
        className={cn(
          buttonVariants({ variant: primary ? "default" : "outline", size: "sm" }),
          iconOnly
            ? "relative h-10 w-10 min-w-10 overflow-visible rounded-lg px-0"
            : primary
              ? "h-11 w-full gap-2 rounded-[10px] px-5 text-sm sm:w-auto"
              : "h-10 gap-2 rounded-lg px-4 text-sm",
          className
        )}
      >
        {Icon && <Icon className="h-4 w-4" />}
        <span className={cn(iconOnly && "sr-only")}>{label}</span>
        {iconOnly && (
          <span className="pointer-events-none absolute -top-9 left-1/2 z-20 -translate-x-1/2 rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background opacity-0 shadow-sm transition-opacity group-hover/button:opacity-100 group-focus-visible/button:opacity-100">
            {label}
          </span>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}

function CreatePurchaseRequestForm({ parts, vendors }: { parts: Part[]; vendors: Vendor[] }) {
  return (
    <form action={createPurchaseRequest} className="space-y-4">
      <div>
        <Label htmlFor="part_id">Part</Label>
        <select id="part_id" name="part_id" className="h-10 w-full rounded-md border bg-background px-3 text-sm" required>
          <option value="">Select part</option>
          {parts.map((part) => (
            <option key={part.id} value={part.id}>
              {part.name} ({part.quantity_on_hand} on hand, min {part.min_threshold})
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="vendor_id">Vendor</Label>
        <select id="vendor_id" name="vendor_id" className="h-10 w-full rounded-md border bg-background px-3 text-sm">
          <option value="">Use preferred vendor</option>
          {vendors.map((vendor) => (
            <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
          ))}
        </select>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="requested_quantity">Qty</Label>
          <Input id="requested_quantity" name="requested_quantity" type="number" min={1} required />
        </div>
        <div>
          <Label htmlFor="estimated_unit_cost">Unit cost</Label>
          <Input id="estimated_unit_cost" name="estimated_unit_cost" type="number" min={0} step="0.01" />
        </div>
        <div>
          <Label htmlFor="needed_by">Needed by</Label>
          <Input id="needed_by" name="needed_by" type="date" />
        </div>
      </div>
      <input type="hidden" name="source" value="manual" />
      <div>
        <Label htmlFor="reason">Reason</Label>
        <Textarea id="reason" name="reason" required />
      </div>
      <Button type="submit" className="w-full">Create PR</Button>
    </form>
  )
}

function CreateVendorForm() {
  return (
    <form action={createVendor} className="grid gap-4 sm:grid-cols-2">
      <div>
        <Label htmlFor="vendor_name">Vendor name</Label>
        <Input id="vendor_name" name="name" required />
      </div>
      <div>
        <Label htmlFor="contact_name">Contact</Label>
        <Input id="contact_name" name="contact_name" />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" />
      </div>
      <div>
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" name="phone" />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="vendor_notes">Notes</Label>
        <Textarea id="vendor_notes" name="notes" />
      </div>
      <Button type="submit" className="sm:col-span-2">Add Vendor</Button>
    </form>
  )
}

function RecordVendorPerformanceForm({ vendors }: { vendors: Vendor[] }) {
  return (
    <form action={recordVendorPerformanceEvent} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="performance_vendor_id">Vendor</Label>
          <select id="performance_vendor_id" name="vendor_id" className="h-10 w-full rounded-md border bg-background px-3 text-sm" required>
            <option value="">Select vendor</option>
            {vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
          </select>
        </div>
        <div>
          <Label htmlFor="event_type">Event</Label>
          <select id="event_type" name="event_type" className="h-10 w-full rounded-md border bg-background px-3 text-sm" required>
            <option value="response">Response time</option>
            <option value="sla">SLA</option>
            <option value="cost">Cost</option>
            <option value="repeat_failure">Repeat failure</option>
          </select>
        </div>
        <div>
          <Label htmlFor="response_time_hours">Response hours</Label>
          <Input id="response_time_hours" name="response_time_hours" type="number" min={0} step="0.25" />
        </div>
        <div>
          <Label htmlFor="sla_met">SLA met</Label>
          <select id="sla_met" name="sla_met" className="h-10 w-full rounded-md border bg-background px-3 text-sm">
            <option value="">Not measured</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </div>
        <div>
          <Label htmlFor="cost_amount">Cost</Label>
          <Input id="cost_amount" name="cost_amount" type="number" min={0} step="0.01" />
        </div>
        <div>
          <Label htmlFor="repeat_failure">Repeat failure</Label>
          <select id="repeat_failure" name="repeat_failure" className="h-10 w-full rounded-md border bg-background px-3 text-sm">
            <option value="false">No</option>
            <option value="true">Yes</option>
          </select>
        </div>
      </div>
      <Button type="submit" className="w-full">Record Performance</Button>
    </form>
  )
}

function CreateContractForm({ vendors }: { vendors: Vendor[] }) {
  return (
    <form action={createContract} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="contract_vendor_id">Vendor</Label>
          <select id="contract_vendor_id" name="vendor_id" className="h-10 w-full rounded-md border bg-background px-3 text-sm" required>
            <option value="">Select vendor</option>
            {vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
          </select>
        </div>
        <div>
          <Label htmlFor="contract_type">Type</Label>
          <select id="contract_type" name="contract_type" className="h-10 w-full rounded-md border bg-background px-3 text-sm" required>
            <option value="AMC">AMC</option>
            <option value="CMC">CMC</option>
          </select>
        </div>
        <div>
          <Label htmlFor="contract_number">Contract number</Label>
          <Input id="contract_number" name="contract_number" required />
        </div>
        <div>
          <Label htmlFor="title">Title</Label>
          <Input id="title" name="title" required />
        </div>
        <div>
          <Label htmlFor="start_date">Start</Label>
          <Input id="start_date" name="start_date" type="date" required />
        </div>
        <div>
          <Label htmlFor="end_date">End</Label>
          <Input id="end_date" name="end_date" type="date" required />
        </div>
        <div>
          <Label htmlFor="alert_days_before_expiry">Alert days</Label>
          <Input id="alert_days_before_expiry" name="alert_days_before_expiry" type="number" min={0} defaultValue={30} />
        </div>
        <div>
          <Label htmlFor="annual_cost">Annual cost</Label>
          <Input id="annual_cost" name="annual_cost" type="number" min={0} step="0.01" />
        </div>
      </div>
      <Button type="submit" className="w-full">Add Contract</Button>
    </form>
  )
}

export function PurchasingWorkspace({
  vendors,
  parts,
  reorderSuggestions,
  purchaseRequests,
  purchaseOrders,
  contracts,
  equipment,
  vendorPerformance,
}: PurchasingWorkspaceProps) {
  const lowStockParts = parts.filter((part) => part.quantity_on_hand <= part.min_threshold)
  const outOfStockParts = parts.filter((part) => part.quantity_on_hand === 0)
  const openOrders = purchaseOrders.filter((po) => po.status !== "received" && po.status !== "cancelled")
  const receivingLines = openOrders.flatMap((po) => po.lines || [])
  const pendingApprovals = purchaseRequests.filter((pr) => pr.status === "pending_approval")
  const approvedAwaitingPo = purchaseRequests.filter((pr) => pr.status === "approved" && !pr.purchase_order_id)
  const expiringContracts = contracts.filter((contract) => ["expiring", "expired"].includes(contract.status))
  const [activeTab, setActiveTab] = useState("approvals")
  const kpis: Array<{
    title: string
    value: number
    description: string
    icon: React.ComponentType<{ className?: string }>
    tone: KpiTone
    tab: string
  }> = [
    {
      title: "Pending approval",
      value: pendingApprovals.length,
      description: "Requires review",
      icon: ClipboardCheck,
      tone: "amber",
      tab: "approvals",
    },
    {
      title: "Awaiting PO",
      value: approvedAwaitingPo.length,
      description: "Ready to issue",
      icon: FileText,
      tone: "blue",
      tab: "approvals",
    },
    {
      title: "Awaiting receipt",
      value: receivingLines.length,
      description: "Track delivery",
      icon: Truck,
      tone: "violet",
      tab: "receiving",
    },
    {
      title: "Out of stock",
      value: outOfStockParts.length,
      description: outOfStockParts.length === 0 ? "All items available" : "Needs replenishment",
      icon: Package,
      tone: "green",
      tab: "reorder",
    },
    {
      title: "Contract alert",
      value: expiringContracts.length,
      description: "Expires within alert window",
      icon: BellRing,
      tone: "red",
      tab: "contracts",
    },
  ]

  return (
    <div className="mx-auto max-w-[1600px] space-y-5">
      <section className="space-y-5 rounded-xl border bg-[#F6F8FB] p-4 shadow-sm sm:p-5 lg:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold tracking-tight text-foreground">Purchasing</h2>
            <p className="text-base text-muted-foreground">Approvals, receiving, reorder suggestions, vendors, and service contracts.</p>
          </div>
          <div className="flex flex-wrap gap-2 sm:items-center sm:justify-end">
            <ActionDialog
              label="Create purchase request"
              title="Create Purchase Request"
              description="Create a manual replenishment request for any tracked part."
              icon={Plus}
              primary
              iconOnly
            >
              <CreatePurchaseRequestForm parts={parts} vendors={vendors} />
            </ActionDialog>
            <ActionDialog label="Add vendor" title="Add Vendor" description="Create a supplier record for preferred parts, contracts, and performance tracking." icon={UserPlus} iconOnly>
              <CreateVendorForm />
            </ActionDialog>
            <ActionDialog label="Add contract" title="Add AMC/CMC Contract" description="Register a service contract and set expiry alert timing." icon={FilePlus2} iconOnly>
              <CreateContractForm vendors={vendors} />
            </ActionDialog>
            <ActionDialog label="Record performance" title="Record Vendor Performance" description="Log response, SLA, cost, or repeat-failure performance evidence." icon={BarChart3} iconOnly>
              <RecordVendorPerformanceForm vendors={vendors} />
            </ActionDialog>
            <form action={refreshContractStatuses}>
              <Button
                type="submit"
                variant="outline"
                size="sm"
                aria-label="Refresh contracts"
                title="Refresh contracts"
                className="relative h-10 w-10 overflow-visible rounded-lg px-0"
              >
                <RefreshCw className="h-4 w-4" />
                <span className="sr-only">Refresh contracts</span>
                <span className="pointer-events-none absolute -top-9 left-1/2 z-20 -translate-x-1/2 rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background opacity-0 shadow-sm transition-opacity group-hover/button:opacity-100 group-focus-visible/button:opacity-100">
                  Refresh contracts
                </span>
              </Button>
            </form>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          {kpis.map((kpi) => (
            <KpiCard
              key={kpi.title}
              title={kpi.title}
              value={kpi.value}
              description={kpi.description}
              icon={kpi.icon}
              tone={kpi.tone}
              size="compact"
              onClick={() => setActiveTab(kpi.tab)}
            />
          ))}
        </div>

      </section>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full min-w-0">
        <div className="overflow-x-auto pb-1">
          <TabsList className="min-w-max">
            <TabsTrigger value="approvals">Approvals</TabsTrigger>
            <TabsTrigger value="receiving">Receiving</TabsTrigger>
            <TabsTrigger value="reorder">Reorder</TabsTrigger>
            <TabsTrigger value="contracts">Contracts</TabsTrigger>
            <TabsTrigger value="vendors">Vendors</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="approvals" className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold">Purchase Requests</h3>
            <p className="text-sm text-muted-foreground">Low stock and manual requests move through approval before PO creation.</p>
          </div>
          <PurchaseRequestsQueue purchaseRequests={purchaseRequests} />
        </TabsContent>

        <TabsContent value="receiving" className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold">Receiving</h3>
            <p className="text-sm text-muted-foreground">Receiving a PO line increments part inventory and closes the PO when fully received.</p>
          </div>
          <ReceivingQueue openOrders={openOrders} />
        </TabsContent>

        <TabsContent value="reorder" className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold">Low-Stock Reorder Suggestions</h3>
            <p className="text-sm text-muted-foreground">Generate replenishment requests from parts at or below reorder level.</p>
          </div>
          {lowStockParts.length > 0 ? (
            <LowStockReorderQueue lowStockParts={lowStockParts} reorderSuggestions={reorderSuggestions} />
          ) : (
            <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
              All tracked parts are above reorder level.
            </div>
          )}
        </TabsContent>

        <TabsContent value="contracts" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold">AMC/CMC Contracts</h3>
              <p className="text-sm text-muted-foreground">Contracts alert before expiry and list covered assets.</p>
            </div>
            <p className="text-sm text-muted-foreground">Annual coverage value {money(contracts.reduce((sum, contract) => sum + Number(contract.annual_cost || 0), 0))}</p>
          </div>
          <ContractsQueue contracts={contracts} equipment={equipment} />
        </TabsContent>

        <TabsContent value="vendors" className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold">Vendor Performance</h3>
            <p className="text-sm text-muted-foreground">Track response time, SLA hit rate, cost, and repeat failures across {vendors.length} vendors.</p>
          </div>
          <VendorPerformanceQueue vendorPerformance={vendorPerformance} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
