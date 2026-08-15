import Link from "next/link"
import { AlertTriangle, Package, Plus, Trash2, Warehouse } from "lucide-react"
import { addEquipmentSparePart, getEquipmentPartsData, removeEquipmentPartRelationship } from "@/lib/actions/equipment-parts"
import { hasPermission } from "@/lib/actions/permissions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ResponsiveTableFrame } from "@/components/shared/responsive-table-frame"
import { formatDateTime, statusColor } from "@/lib/utils/format"

export async function EquipmentPartsTab({ equipmentId }: { equipmentId: string }) {
  const [{ parts, availableParts }, canManage] = await Promise.all([
    getEquipmentPartsData(equipmentId),
    hasPermission({ action: "write", resource: "equipment" }),
  ])
  const lowStockCount = parts.filter((part) => part.quantityOnHand <= part.minThreshold).length
  const currentStock = parts.reduce((sum, part) => sum + part.quantityOnHand, 0)

  return (
    <div className="space-y-5">
      {canManage && (
        <details className="rounded-lg border bg-muted p-4" open={parts.length === 0}>
          <summary className="flex cursor-pointer list-none items-center gap-2 font-medium">
            <Plus className="h-4 w-4" /> Add related spare part
          </summary>
          <form action={addEquipmentSparePart.bind(null, equipmentId)} className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label htmlFor="part_id">Inventory part *</Label>
              <select id="part_id" name="part_id" required className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Select a spare part...</option>
                {availableParts.map((part) => <option key={part.id} value={part.id}>{part.name}{part.partNumber ? ` (${part.partNumber})` : ""} · {part.quantityOnHand} in stock</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="scope_type">Apply to</Label>
              <select id="scope_type" name="scope_type" defaultValue="model" className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="equipment">This equipment only</option>
                <option value="model">All equipment of this manufacturer and model</option>
                <option value="manufacturer">All equipment from this manufacturer</option>
                <option value="category">All equipment in this device category</option>
                <option value="universal">Universal — all equipment</option>
              </select>
            </div>
            <div>
              <Label htmlFor="relationship_type">Relationship</Label>
              <select id="relationship_type" name="relationship_type" defaultValue="compatible" className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="compatible">Compatible spare</option>
                <option value="recommended">Recommended stock</option>
                <option value="critical">Critical spare</option>
              </select>
            </div>
            <div>
              <Label htmlFor="recommended_quantity">Recommended quantity</Label>
              <Input id="recommended_quantity" name="recommended_quantity" type="number" min={1} placeholder="Optional" />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="spare_part_notes">Notes</Label>
              <Input id="spare_part_notes" name="notes" placeholder="Compatibility, model, or replacement notes" />
            </div>
            <div className="md:col-span-2"><Button type="submit" disabled={availableParts.length === 0}>Add Spare Part</Button></div>
          </form>
          {availableParts.length === 0 && <p className="mt-3 text-sm text-muted-foreground">All inventory parts are already linked to this equipment.</p>}
        </details>
      )}

      {parts.length === 0 ? (
        <div className="py-10 text-center">
          <Package className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-medium">No spare parts linked yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Add an inventory part above to see its live stock here before it is ever used.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card><CardContent className="flex items-center gap-3 p-4"><Package className="h-5 w-5 text-primary" /><div><p className="text-2xl font-semibold">{parts.length}</p><p className="text-xs text-muted-foreground">Related part types</p></div></CardContent></Card>
            <Card><CardContent className="flex items-center gap-3 p-4"><Warehouse className="h-5 w-5 text-primary" /><div><p className="text-2xl font-semibold">{currentStock}</p><p className="text-xs text-muted-foreground">Units currently in stock</p></div></CardContent></Card>
            <Card><CardContent className="flex items-center gap-3 p-4"><AlertTriangle className="h-5 w-5 text-warning-strong" /><div><p className="text-2xl font-semibold">{lowStockCount}</p><p className="text-xs text-muted-foreground">Low-stock related parts</p></div></CardContent></Card>
          </div>

          <div className="grid gap-3 md:hidden">
            {parts.map((part) => {
              const lowStock = part.quantityOnHand <= part.minThreshold
              return <div key={part.partId} className="rounded-lg border p-4">
                <div className="flex items-start justify-between gap-3"><div><p className="font-medium">{part.name}</p><p className="font-mono text-xs text-muted-foreground">{part.partNumber || "No part number"}</p></div><Badge className={statusColor(lowStock ? "low_stock" : "ok")}>{lowStock ? "Low stock" : "In stock"}</Badge></div>
                <div className="mt-3 flex flex-wrap gap-2"><Badge variant="outline">{part.scopeLabel}</Badge><Badge variant="outline" className="capitalize">{part.relationshipType.replaceAll("_", " ")}</Badge>{part.recommendedQuantity && <Badge variant="outline">Recommended: {part.recommendedQuantity}</Badge>}</div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-sm"><div><span className="block text-xs text-muted-foreground">In stock</span>{part.quantityOnHand}</div><div><span className="block text-xs text-muted-foreground">Used</span>{part.totalUsed}</div><div><span className="block text-xs text-muted-foreground">Work orders</span>{part.workOrderCount}</div></div>
                <div className="mt-3 space-y-1 text-xs text-muted-foreground">{part.stockLocations.length ? part.stockLocations.map((stock) => <p key={`${stock.code}-${stock.binCode}`}>{stock.name} · {stock.quantity}{stock.binCode ? ` · Bin ${stock.binCode}` : ""}</p>) : <p>No detailed stock location</p>}</div>
                {part.lastUsedAt && part.lastWorkOrderId && <Link href={`/work-orders/${part.lastWorkOrderId}`} className="mt-3 block text-sm text-primary hover:underline">Last used {formatDateTime(part.lastUsedAt)}</Link>}
                {canManage && part.relationshipId && part.relationshipSource !== "historical" && <form action={removeEquipmentPartRelationship.bind(null, equipmentId, part.relationshipId, part.relationshipSource)} className="mt-3"><Button type="submit" variant="ghost" size="sm" className="text-danger-strong"><Trash2 className="mr-1 h-4 w-4" />{part.relationshipSource === "rule" ? "Remove compatibility rule" : "Unlink"}</Button></form>}
              </div>
            })}
          </div>

          <ResponsiveTableFrame className="hidden md:block">
            <Table className="min-w-[1050px]"><TableHeader><TableRow><TableHead>Spare Part</TableHead><TableHead>Relationship</TableHead><TableHead>Current Stock</TableHead><TableHead>Minimum</TableHead><TableHead>Status</TableHead><TableHead>Stock Locations</TableHead><TableHead>Usage History</TableHead>{canManage && <TableHead>Action</TableHead>}</TableRow></TableHeader>
              <TableBody>{parts.map((part) => { const lowStock = part.quantityOnHand <= part.minThreshold; return <TableRow key={part.partId}>
                <TableCell><p className="font-medium">{part.name}</p><p className="font-mono text-xs text-muted-foreground">{part.partNumber || "—"}</p>{part.supplier && <p className="text-xs text-muted-foreground">{part.supplier}</p>}</TableCell>
                <TableCell><Badge variant="outline">{part.scopeLabel}</Badge><p className="mt-1 text-xs capitalize text-muted-foreground">{part.relationshipType.replaceAll("_", " ")}</p>{part.recommendedQuantity && <p className="mt-1 text-xs text-muted-foreground">Keep {part.recommendedQuantity}</p>}{part.notes && <p className="mt-1 max-w-48 text-xs text-muted-foreground">{part.notes}</p>}</TableCell>
                <TableCell className="text-lg font-semibold">{part.quantityOnHand}</TableCell><TableCell>{part.minThreshold}</TableCell><TableCell><Badge className={statusColor(lowStock ? "low_stock" : "ok")}>{lowStock ? "Low stock" : "In stock"}</Badge></TableCell>
                <TableCell>{part.stockLocations.length ? <div className="space-y-1">{part.stockLocations.map((stock) => <p key={`${stock.code}-${stock.binCode}`} className="text-xs">{stock.name}: {stock.quantity}{stock.binCode ? ` · ${stock.binCode}` : ""}</p>)}</div> : "—"}</TableCell>
                <TableCell><p>{part.totalUsed} used · {part.workOrderCount} WOs</p>{part.lastUsedAt && part.lastWorkOrderId ? <><Link href={`/work-orders/${part.lastWorkOrderId}`} className="text-xs text-primary hover:underline">{formatDateTime(part.lastUsedAt)}</Link><p className="max-w-52 truncate text-xs text-muted-foreground">{part.lastWorkOrderDescription}</p></> : <p className="text-xs text-muted-foreground">Never used</p>}</TableCell>
                {canManage && <TableCell>{part.relationshipId && part.relationshipSource !== "historical" ? <form action={removeEquipmentPartRelationship.bind(null, equipmentId, part.relationshipId, part.relationshipSource)}><Button type="submit" variant="ghost" size="icon" aria-label={`Remove relationship for ${part.name}`} title={part.relationshipSource === "rule" ? "Remove compatibility rule from all matching equipment" : "Unlink from this equipment"}><Trash2 className="h-4 w-4 text-danger-strong" /></Button></form> : <span className="text-xs text-muted-foreground">Usage-derived</span>}</TableCell>}
              </TableRow>})}</TableBody>
            </Table>
          </ResponsiveTableFrame>
        </>
      )}
    </div>
  )
}
