"use client"

import { restockPart } from "@/lib/actions/parts"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogDescription,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import type { Part } from "@/lib/types"

interface Props {
  data: Part[]
}

export function PartsTable({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-8 text-center text-gray-500">
        No parts in inventory.
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Part Name</TableHead>
            <TableHead>Part Number</TableHead>
            <TableHead>Qty On Hand</TableHead>
            <TableHead>Min Threshold</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Unit Cost</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((part) => {
            const isLow = part.quantity_on_hand <= part.min_threshold
            return (
              <TableRow key={part.id}>
                <TableCell className="font-medium">{part.name}</TableCell>
                <TableCell className="font-mono text-xs">{part.part_number || "—"}</TableCell>
                <TableCell>{part.quantity_on_hand}</TableCell>
                <TableCell>{part.min_threshold}</TableCell>
                <TableCell>
                  {isLow ? (
                    <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                      Low Stock
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                      OK
                    </span>
                  )}
                </TableCell>
                <TableCell>${part.unit_cost?.toFixed(2) || "—"}</TableCell>
                <TableCell>{part.location || "—"}</TableCell>
                <TableCell>
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
                        <Button type="submit" className="w-full">
                          Confirm Restock
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
