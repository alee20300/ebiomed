"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

export function ReportsDateFilter() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [from, setFrom] = useState(searchParams.get("from") || "")
  const [to, setTo] = useState(searchParams.get("to") || "")

  const applyFilter = () => {
    const params = new URLSearchParams()
    if (from) params.set("from", from)
    if (to) params.set("to", to)
    router.push(`/reports?${params.toString()}`)
  }

  const clearFilter = () => {
    setFrom("")
    setTo("")
    router.push("/reports")
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <Label htmlFor="report-from" className="text-xs">From</Label>
        <Input
          id="report-from"
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="w-auto"
        />
      </div>
      <div>
        <Label htmlFor="report-to" className="text-xs">To</Label>
        <Input
          id="report-to"
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="w-auto"
        />
      </div>
      <Button size="sm" onClick={applyFilter}>Filter</Button>
      <Button size="sm" variant="outline" onClick={clearFilter}>Clear</Button>
    </div>
  )
}
