"use client"

import { useMemo, useState } from "react"
import { AlertTriangle, DollarSign, Warehouse } from "lucide-react"
import { createPurchaseRequestFromReorderSuggestion } from "@/lib/actions/purchasing"
import { restockPart } from "@/lib/actions/parts"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { statusColor } from "@/lib/utils/format"
import { Label } from "@/components/ui/label"
import { KpiCard } from "@/components/shared/kpi-card"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { ResponsiveTableFrame } from "@/components/shared/responsive-table-frame"
import { ListControls, matchesQuery, paginate } from "@/components/shared/list-controls"
import {
  Dialog, DialogContent, DialogDescription,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import type { InventoryValuationRow, Part, PartStockBalance, ReorderSuggestion } from "@/lib/types"

interface Props {
  data: Part[]
  inventory: {
    balances: PartStockBalance[]
    valuation: InventoryValuationRow[]
    reorderSuggestions: ReorderSuggestion[]
  }
}

function money(value: number | null | undefined) {
  return value == null ? "—" : `$${Number(value).toFixed(2)}`
}

export function PartsTable({ data, inventory }: Props) {
  const pageSize = 15
  const [filter, setFilter] = useState("all")
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)

  if (data.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-8 text-center text-muted-foreground">
        No parts in inventory.
      </div>
    )
  }

  const totalValue = inventory.valuation.reduce((sum, row) => sum + Number(row.inventory_value || 0), 0)
  const balancesByPart = new Map<string, PartStockBalance[]>()
  for (const balance of inventory.balances) {
    balancesByPart.set(balance.part_id, [...(balancesByPart.get(balance.part_id) || []), balance])
  }
  const suggestionsByPart = new Map(inventory.reorderSuggestions.map((item) => [item.part_id, item]))
  const filteredData = data.filter((part) => {
    const isLow = part.quantity_on_hand <= part.min_threshold
    const isOut = part.quantity_on_hand === 0
    const balances = balancesByPart.get(part.id) || []
    const matchesFilter =
      filter === "all" ||
      (filter === "low" && isLow) ||
      (filter === "out" && isOut) ||
      (filter === "ok" && !isLow)

    return matchesFilter && matchesQuery([
      part.name,
      part.part_number,
      part.supplier,
      part.preferred_vendor?.name,
      part.stock_location,
      part.location,
      part.bin_code,
      ...balances.map((balance) => balance.bin_code),
    ], query)
  })
  const pageData = paginate(filteredData, page, pageSize)
  const filters = [
    { value: "all", label: "All" },
    { value: "low", label: "Low Stock" },
    { value: "out", label: "Out" },
    { value: "ok", label: "OK" },
  ]

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <KpiCard title="Inventory Value" value={money(totalValue)} description="Current valued stock" icon={DollarSign} tone="green" size="compact" />
        <KpiCard title="Low Stock Lines" value={inventory.reorderSuggestions.length} description="At or below reorder level" icon={AlertTriangle} tone="amber" size="compact" />
        <KpiCard title="Stock Locations" value={new Set(inventory.balances.map((row) => row.stock_location_id)).size} description="Active inventory locations" icon={Warehouse} tone="blue" size="compact" />
      </div>
      <ListControls
        filters={filters}
        activeFilter={filter}
        onFilterChange={setFilter}
        query={query}
        onQueryChange={setQuery}
        searchPlaceholder="Search parts"
        page={pageData.page}
        totalPages={pageData.totalPages}
        totalItems={filteredData.length}
        pageSize={pageSize}
        onPageChange={setPage}
      />
      <div className="grid gap-3 md:hidden">
        {pageData.items.map((part) => {
          const isLow = part.quantity_on_hand <= part.min_threshold
          const value = part.quantity_on_hand * Number(part.unit_cost || 0)
          const suggestion = suggestionsByPart.get(part.id)
          return (
            <div key={part.id} className="rounded-lg border bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{part.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">{part.part_number || "No part number"}</p>
                </div>
                <Badge className={statusColor(isLow ? "low_stock" : "ok")}>
                  {isLow ? "Low" : "OK"}
                </Badge>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div><span className="block text-muted-foreground">Qty</span><span className="font-medium">{part.quantity_on_hand}</span></div>
                <div><span className="block text-muted-foreground">Min</span><span className="font-medium">{part.min_threshold}</span></div>
                <div><span className="block text-muted-foreground">Value</span><span className="font-medium">{money(value)}</span></div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Dialog>
                  <DialogTrigger className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>Restock</DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Restock: {part.name}</DialogTitle>
                      <DialogDescription>Current quantity: {part.quantity_on_hand}</DialogDescription>
                    </DialogHeader>
                    <form action={restockPart} className="space-y-4">
                      <input type="hidden" name="id" value={part.id} />
                      <div>
                        <Label htmlFor={`mobile-quantity-${part.id}`}>Quantity to Add</Label>
                        <Input id={`mobile-quantity-${part.id}`} name="quantity" type="number" min={1} required />
                      </div>
                      <div>
                        <Label htmlFor={`mobile-restock-reason-${part.id}`}>Reason</Label>
                        <Input id={`mobile-restock-reason-${part.id}`} name="reason" required minLength={5} defaultValue="Stock received" />
                      </div>
                      <Button type="submit" className="w-full">Confirm Restock</Button>
                    </form>
                  </DialogContent>
                </Dialog>
                {isLow && (
                  <form action={createPurchaseRequestFromReorderSuggestion}>
                    <input type="hidden" name="part_id" value={part.id} />
                    <Button type="submit" size="sm">PR {suggestion ? `(${suggestion.reorder_quantity})` : ""}</Button>
                  </form>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <ResponsiveTableFrame className="hidden md:block">
      <Table className="min-w-[1080px]">
        <TableHeader>
          <TableRow>
            <TableHead>Part Name</TableHead>
            <TableHead>Part Number</TableHead>
            <TableHead>Qty On Hand</TableHead>
            <TableHead>Min/Max</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Unit Cost</TableHead>
            <TableHead>Value</TableHead>
            <TableHead>Preferred Vendor</TableHead>
            <TableHead>Lead Time</TableHead>
            <TableHead>Location/Bin</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageData.items.map((part) => {
            const isLow = part.quantity_on_hand <= part.min_threshold
            const value = part.quantity_on_hand * Number(part.unit_cost || 0)
            const balances = balancesByPart.get(part.id) || []
            const suggestion = suggestionsByPart.get(part.id)
            return (
              <TableRow key={part.id}>
                <TableCell className="font-medium">{part.name}</TableCell>
                <TableCell className="font-mono text-xs">{part.part_number || "—"}</TableCell>
                <TableCell>{part.quantity_on_hand}</TableCell>
                <TableCell>
                  <div>{part.min_threshold} / {part.max_threshold ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">Reorder {part.reorder_quantity ?? Math.max(part.min_threshold, 1)}</div>
                </TableCell>
                <TableCell>
                  {isLow ? (
                    <Badge className={statusColor("low_stock")}>
                      Low Stock
                    </Badge>
                  ) : (
                    <Badge className={statusColor("ok")}>
                      OK
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div>{money(part.unit_cost)}</div>
                  <div className="text-xs capitalize text-muted-foreground">{part.valuation_method.replace(/_/g, " ")}</div>
                </TableCell>
                <TableCell>{money(value)}</TableCell>
                <TableCell>
                  <div>{part.preferred_vendor?.name || part.supplier || "—"}</div>
                  {part.vendor_price != null && (
                    <div className="text-xs text-muted-foreground">${part.vendor_price.toFixed(2)}</div>
                  )}
                </TableCell>
                <TableCell>{part.lead_time_days == null ? "—" : `${part.lead_time_days}d`}</TableCell>
                <TableCell>
                  <div>{part.stock_location || part.location || "—"}</div>
                  <div className="text-xs text-muted-foreground">{part.bin_code || balances[0]?.bin_code || "No bin"}</div>
                  {balances.length > 1 && <div className="text-xs text-muted-foreground">{balances.length} balances</div>}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    <Dialog>
                      <DialogTrigger className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>Restock</DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Restock: {part.name}</DialogTitle>
                          <DialogDescription>
                            Current quantity: {part.quantity_on_hand}
                          </DialogDescription>
                        </DialogHeader>
                        <form action={restockPart} className="space-y-4">
                          <input type="hidden" name="id" value={part.id} />
                          <div>
                            <Label htmlFor="quantity">Quantity to Add</Label>
                            <Input
                              id="quantity"
                              name="quantity"
                              type="number"
                              min={1}
                              required
                            />
                          </div>
                          <div>
                            <Label htmlFor="restock-reason">Reason</Label>
                            <Input id="restock-reason" name="reason" required minLength={5} defaultValue="Stock received" />
                          </div>
                          <Button type="submit" className="w-full">
                            Confirm Restock
                          </Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                    {isLow && (
                      <form action={createPurchaseRequestFromReorderSuggestion}>
                        <input type="hidden" name="part_id" value={part.id} />
                        <Button type="submit" size="sm">
                          PR {suggestion ? `(${suggestion.reorder_quantity})` : ""}
                        </Button>
                      </form>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      </ResponsiveTableFrame>
    </div>
  )
}
