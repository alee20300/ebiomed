"use client"

import { useMemo, useState } from "react"

import {
  addContractAsset,
  approvePurchaseRequest,
  createPurchaseOrderFromRequest,
  createPurchaseRequestFromReorderSuggestion,
  receivePurchaseOrderLine,
  rejectPurchaseRequest,
} from "@/lib/actions/purchasing"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ResponsiveTableFrame } from "@/components/shared/responsive-table-frame"
import { ListControls, matchesQuery, paginate } from "@/components/shared/list-controls"
import type { Contract, Equipment, Part, PurchaseOrder, PurchaseOrderLine, PurchaseRequest, ReorderSuggestion, VendorPerformanceSummary } from "@/lib/types"

function money(value: number | null | undefined) {
  if (value == null) return "-"
  return `$${Number(value).toFixed(2)}`
}

function daysUntil(date: string) {
  const diff = new Date(date).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info" {
  if (["approved", "received", "active"].includes(status)) return "success"
  if (["pending_approval", "issued", "partially_received", "expiring"].includes(status)) return "warning"
  if (["rejected", "expired", "cancelled"].includes(status)) return "destructive"
  if (["converted"].includes(status)) return "info"
  return "default"
}

export function PurchaseRequestsQueue({ purchaseRequests }: { purchaseRequests: PurchaseRequest[] }) {
  const pageSize = 10
  const [filter, setFilter] = useState("active")
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  const filtered = useMemo(() => purchaseRequests.filter((request) => {
    const active = !["converted", "cancelled", "rejected"].includes(request.status)
    const matchesFilter =
      filter === "all" ||
      (filter === "active" && active) ||
      request.status === filter ||
      request.source === filter ||
      request.approval_level === filter

    return matchesFilter && matchesQuery([
      request.request_number,
      request.part?.name,
      request.vendor?.name,
      request.part?.preferred_vendor?.name,
      request.status,
      request.source,
      request.reason,
    ], query)
  }), [filter, purchaseRequests, query])
  const pageData = paginate(filtered, page, pageSize)
  const filters = [
    { value: "active", label: "Active" },
    { value: "all", label: "All" },
    { value: "pending_approval", label: "Pending" },
    { value: "approved", label: "Approved" },
    { value: "converted", label: "Converted" },
    { value: "reorder", label: "Reorder" },
    { value: "finance", label: "Finance" },
  ]

  return (
    <div className="space-y-3">
      {purchaseRequests.length > 0 && (
        <ListControls
          filters={filters}
          activeFilter={filter}
          onFilterChange={setFilter}
          query={query}
          onQueryChange={setQuery}
          searchPlaceholder="Search purchase requests"
          page={pageData.page}
          totalPages={pageData.totalPages}
          totalItems={filtered.length}
          pageSize={pageSize}
          onPageChange={setPage}
        />
      )}
      <ResponsiveTableFrame className="bg-card">
        <Table className="min-w-[760px]">
          <TableHeader>
            <TableRow>
              <TableHead>Request</TableHead>
              <TableHead>Part</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {purchaseRequests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  No purchase requests.
                </TableCell>
              </TableRow>
            ) : pageData.items.map((request) => (
              <TableRow key={request.id}>
                <TableCell>
                  <div className="font-medium">{request.request_number}</div>
                  <div className="text-xs text-muted-foreground">{request.source}</div>
                </TableCell>
                <TableCell>{request.part?.name || "-"}</TableCell>
                <TableCell>{request.vendor?.name || request.part?.preferred_vendor?.name || "-"}</TableCell>
                <TableCell>{request.requested_quantity}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant(request.status)}>{request.status.replaceAll("_", " ")}</Badge>
                </TableCell>
                <TableCell>
                  {request.status === "pending_approval" && (
                    <div className="flex flex-wrap gap-2">
                      <form action={approvePurchaseRequest}>
                        <input type="hidden" name="id" value={request.id} />
                        <Button type="submit" size="sm">Approve</Button>
                      </form>
                      <form action={rejectPurchaseRequest}>
                        <input type="hidden" name="id" value={request.id} />
                        <input type="hidden" name="reason" value="Rejected from purchasing queue" />
                        <Button type="submit" size="sm" variant="outline">Reject</Button>
                      </form>
                    </div>
                  )}
                  {request.status === "approved" && (
                    <form action={createPurchaseOrderFromRequest} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="purchase_request_id" value={request.id} />
                      <Input name="expected_delivery" type="date" className="h-9 w-36" aria-label="Expected delivery" />
                      <Button type="submit" size="sm">Create PO</Button>
                    </form>
                  )}
                  {request.purchase_order_id && <span className="text-xs text-muted-foreground">PO created</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ResponsiveTableFrame>
    </div>
  )
}

export function LowStockReorderQueue({
  lowStockParts,
  reorderSuggestions,
}: {
  lowStockParts: Part[]
  reorderSuggestions: ReorderSuggestion[]
}) {
  const pageSize = 8
  const [filter, setFilter] = useState("all")
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  const suggestionsByPart = useMemo(() => new Map(reorderSuggestions.map((suggestion) => [suggestion.part_id, suggestion])), [reorderSuggestions])
  const filtered = useMemo(() => lowStockParts.filter((part) => {
    const matchesFilter =
      filter === "all" ||
      (filter === "out" && part.quantity_on_hand === 0) ||
      (filter === "below" && part.quantity_on_hand > 0 && part.quantity_on_hand < part.min_threshold) ||
      (filter === "reorder" && part.quantity_on_hand === part.min_threshold)

    return matchesFilter && matchesQuery([
      part.name,
      part.part_number,
      part.supplier,
      part.preferred_vendor?.name,
      part.stock_location,
      part.location,
    ], query)
  }), [filter, lowStockParts, query])
  const pageData = paginate(filtered, page, pageSize)
  const filters = [
    { value: "all", label: "All" },
    { value: "out", label: "Out" },
    { value: "below", label: "Below Min" },
    { value: "reorder", label: "Reorder" },
  ]

  if (lowStockParts.length === 0) return null

  return (
    <div className="space-y-3">
      <ListControls
        filters={filters}
        activeFilter={filter}
        onFilterChange={setFilter}
        query={query}
        onQueryChange={setQuery}
        searchPlaceholder="Search low stock"
        page={pageData.page}
        totalPages={pageData.totalPages}
        totalItems={filtered.length}
        pageSize={pageSize}
        onPageChange={setPage}
      />
      <ResponsiveTableFrame className="bg-card">
        <Table className="min-w-[520px]">
          <TableHeader>
            <TableRow>
              <TableHead>Low stock part</TableHead>
              <TableHead>Reorder</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageData.items.map((part) => {
              const suggestion = suggestionsByPart.get(part.id)
              const reorderQuantity = suggestion?.reorder_quantity ?? Math.max(part.min_threshold * 2 - part.quantity_on_hand, 1)
              return (
                <TableRow key={part.id}>
                  <TableCell>
                    <div className="font-medium">{part.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {part.quantity_on_hand} on hand / min {part.min_threshold}
                    </div>
                  </TableCell>
                  <TableCell>
                    <form action={createPurchaseRequestFromReorderSuggestion} className="flex items-center gap-2">
                      <input type="hidden" name="part_id" value={part.id} />
                      <Button type="submit" size="sm">Generate PR ({reorderQuantity})</Button>
                    </form>
                    {suggestion?.latest_supplier_price != null && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Latest supplier price {money(suggestion.latest_supplier_price)}
                      </p>
                    )}
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

type ReceivingLine = {
  order: PurchaseOrder
  line: PurchaseOrderLine
}

export function ReceivingQueue({ openOrders }: { openOrders: PurchaseOrder[] }) {
  const pageSize = 10
  const [filter, setFilter] = useState("all")
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  const rows = useMemo(() => openOrders.flatMap((order) => (order.lines || []).map((line) => ({ order, line }))), [openOrders])
  const filtered = useMemo(() => rows.filter(({ order, line }) => {
    const remaining = line.quantity_ordered - line.quantity_received
    const matchesFilter =
      filter === "all" ||
      order.status === filter ||
      (filter === "remaining" && remaining > 0) ||
      (filter === "complete" && remaining <= 0)

    return matchesFilter && matchesQuery([
      order.po_number,
      order.vendor?.name,
      order.status,
      line.part?.name,
    ], query)
  }), [filter, query, rows])
  const pageData = paginate<ReceivingLine>(filtered, page, pageSize)
  const filters = [
    { value: "all", label: "All" },
    { value: "remaining", label: "Remaining" },
    { value: "issued", label: "Issued" },
    { value: "partially_received", label: "Partial" },
    { value: "complete", label: "Complete Lines" },
  ]

  return (
    <div className="space-y-3">
      {rows.length > 0 && (
        <ListControls
          filters={filters}
          activeFilter={filter}
          onFilterChange={setFilter}
          query={query}
          onQueryChange={setQuery}
          searchPlaceholder="Search receiving"
          page={pageData.page}
          totalPages={pageData.totalPages}
          totalItems={filtered.length}
          pageSize={pageSize}
          onPageChange={setPage}
        />
      )}
      <ResponsiveTableFrame className="bg-card">
        <Table className="min-w-[840px]">
          <TableHeader>
            <TableRow>
              <TableHead>PO</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Line</TableHead>
              <TableHead>Receive</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {openOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  No purchase orders awaiting receipt.
                </TableCell>
              </TableRow>
            ) : pageData.items.map(({ order, line }) => {
              const remaining = line.quantity_ordered - line.quantity_received
              return (
                <TableRow key={line.id}>
                  <TableCell>
                    <div className="font-medium">{order.po_number}</div>
                    <div className="text-xs text-muted-foreground">{money(order.total_amount)}</div>
                  </TableCell>
                  <TableCell>{order.vendor?.name || "-"}</TableCell>
                  <TableCell><Badge variant={statusVariant(order.status)}>{order.status.replaceAll("_", " ")}</Badge></TableCell>
                  <TableCell>
                    <div>{line.part?.name || "-"}</div>
                    <div className="text-xs text-muted-foreground">
                      {line.quantity_received} / {line.quantity_ordered} received
                    </div>
                  </TableCell>
                  <TableCell>
                    {remaining > 0 ? (
                      <form action={receivePurchaseOrderLine} className="flex items-end gap-2">
                        <input type="hidden" name="purchase_order_id" value={order.id} />
                        <input type="hidden" name="purchase_order_line_id" value={line.id} />
                        <Input
                          name="quantity_received"
                          type="number"
                          min={1}
                          max={remaining}
                          defaultValue={remaining}
                          className="h-9 w-24"
                          aria-label="Quantity received"
                        />
                        <Button type="submit" size="sm">Receive</Button>
                      </form>
                    ) : (
                      <Badge variant="success">Complete</Badge>
                    )}
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

export function VendorPerformanceQueue({ vendorPerformance }: { vendorPerformance: VendorPerformanceSummary[] }) {
  const pageSize = 8
  const [filter, setFilter] = useState("all")
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  const filtered = useMemo(() => vendorPerformance.filter((summary) => {
    const matchesFilter =
      filter === "all" ||
      (filter === "repeat_failures" && summary.repeat_failures > 0) ||
      (filter === "low_sla" && summary.sla_hit_rate !== null && summary.sla_hit_rate < 90) ||
      (filter === "cost" && Number(summary.total_cost) > 0)

    return matchesFilter && matchesQuery([
      summary.vendor.name,
      summary.vendor.contact_name,
      summary.vendor.email,
      summary.vendor.phone,
    ], query)
  }), [filter, query, vendorPerformance])
  const pageData = paginate(filtered, page, pageSize)
  const filters = [
    { value: "all", label: "All" },
    { value: "repeat_failures", label: "Repeats" },
    { value: "low_sla", label: "SLA < 90%" },
    { value: "cost", label: "Cost Logged" },
  ]

  return (
    <div className="space-y-3">
      {vendorPerformance.length > 0 && (
        <ListControls
          filters={filters}
          activeFilter={filter}
          onFilterChange={setFilter}
          query={query}
          onQueryChange={setQuery}
          searchPlaceholder="Search vendors"
          page={pageData.page}
          totalPages={pageData.totalPages}
          totalItems={filtered.length}
          pageSize={pageSize}
          onPageChange={setPage}
        />
      )}
      <ResponsiveTableFrame className="bg-card">
        <Table className="min-w-[620px]">
          <TableHeader>
            <TableRow>
              <TableHead>Vendor</TableHead>
              <TableHead>Response</TableHead>
              <TableHead>SLA</TableHead>
              <TableHead>Cost</TableHead>
              <TableHead>Repeats</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vendorPerformance.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  No vendor performance events.
                </TableCell>
              </TableRow>
            ) : pageData.items.map((summary) => (
              <TableRow key={summary.vendor.id}>
                <TableCell>{summary.vendor.name}</TableCell>
                <TableCell>{summary.average_response_hours == null ? "-" : `${summary.average_response_hours.toFixed(1)}h`}</TableCell>
                <TableCell>{summary.sla_hit_rate == null ? "-" : `${summary.sla_hit_rate.toFixed(0)}%`}</TableCell>
                <TableCell>{money(summary.total_cost)}</TableCell>
                <TableCell>{summary.repeat_failures}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ResponsiveTableFrame>
    </div>
  )
}

export function ContractsQueue({ contracts, equipment }: { contracts: Contract[]; equipment: Equipment[] }) {
  const pageSize = 8
  const [filter, setFilter] = useState("active")
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  const filtered = useMemo(() => contracts.filter((contract) => {
    const matchesFilter =
      filter === "all" ||
      contract.status === filter ||
      contract.contract_type === filter

    return matchesFilter && matchesQuery([
      contract.title,
      contract.contract_number,
      contract.contract_type,
      contract.vendor?.name,
      contract.notes,
      ...(contract.assets || []).flatMap((asset) => [asset.equipment?.tag_number, asset.equipment?.name]),
    ], query)
  }), [contracts, filter, query])
  const pageData = paginate(filtered, page, pageSize)
  const filters = [
    { value: "active", label: "Active" },
    { value: "all", label: "All" },
    { value: "expiring", label: "Expiring" },
    { value: "expired", label: "Expired" },
    { value: "AMC", label: "AMC" },
    { value: "CMC", label: "CMC" },
  ]

  return (
    <div className="space-y-3">
      {contracts.length > 0 && (
        <ListControls
          filters={filters}
          activeFilter={filter}
          onFilterChange={setFilter}
          query={query}
          onQueryChange={setQuery}
          searchPlaceholder="Search contracts"
          page={pageData.page}
          totalPages={pageData.totalPages}
          totalItems={filtered.length}
          pageSize={pageSize}
          onPageChange={setPage}
        />
      )}
      <ResponsiveTableFrame className="bg-card">
        <Table className="min-w-[820px]">
          <TableHeader>
            <TableRow>
              <TableHead>Contract</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Expiry</TableHead>
              <TableHead>Covered assets</TableHead>
              <TableHead>Add asset</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contracts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  No contracts.
                </TableCell>
              </TableRow>
            ) : pageData.items.map((contract) => {
              const remainingDays = daysUntil(contract.end_date)
              return (
                <TableRow key={contract.id}>
                  <TableCell>
                    <div className="font-medium">{contract.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {contract.contract_number} / {contract.contract_type}
                    </div>
                  </TableCell>
                  <TableCell>{contract.vendor?.name || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(contract.status)}>
                      {contract.status.replaceAll("_", " ")} · {remainingDays < 0 ? `${Math.abs(remainingDays)}d expired` : `${remainingDays}d left`}
                    </Badge>
                    {contract.status_reviewed_at && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        Reviewed {new Date(contract.status_reviewed_at).toLocaleDateString()}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {(contract.assets || []).length === 0 ? "-" : (
                      <div className="space-y-1">
                        {(contract.assets || []).slice(0, 3).map((asset) => (
                          <div key={asset.id} className="text-xs">
                            {asset.equipment?.tag_number} {asset.equipment?.name}
                          </div>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <form action={addContractAsset} className="flex items-end gap-2">
                      <input type="hidden" name="contract_id" value={contract.id} />
                      <select name="equipment_id" className="h-9 w-44 rounded-md border bg-background px-2 text-xs" required>
                        <option value="">Select asset</option>
                        {equipment.map((asset) => (
                          <option key={asset.id} value={asset.id}>{asset.tag_number} {asset.name}</option>
                        ))}
                      </select>
                      <Button type="submit" size="sm">Add</Button>
                    </form>
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
