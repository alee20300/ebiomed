"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"
import { Download } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ReportId } from "@/lib/reports/definitions"
import type { ReportingFilterOptions } from "@/lib/reports/service"

interface Props {
  options: ReportingFilterOptions
  report: ReportId
}

export function ReportsDateFilter({ options, report }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [from, setFrom] = useState(searchParams.get("from") || "")
  const [to, setTo] = useState(searchParams.get("to") || "")
  const [department, setDepartment] = useState(searchParams.get("department") || "")
  const [category, setCategory] = useState(searchParams.get("category") || "")
  const [technician, setTechnician] = useState(searchParams.get("technician") || "")
  const [priority, setPriority] = useState(searchParams.get("priority") || "")
  const [vendor, setVendor] = useState(searchParams.get("vendor") || "")
  const [site, setSite] = useState(searchParams.get("site") || "")

  const buildParams = () => {
    const params = new URLSearchParams()
    if (from) params.set("from", from)
    if (to) params.set("to", to)
    if (department) params.set("department", department)
    if (category) params.set("category", category)
    if (technician) params.set("technician", technician)
    if (priority) params.set("priority", priority)
    if (vendor) params.set("vendor", vendor)
    if (site) params.set("site", site)
    params.set("report", report)
    return params
  }

  const applyFilter = () => {
    router.push(`/reports?${buildParams().toString()}`)
  }

  const clearFilter = () => {
    setFrom("")
    setTo("")
    setDepartment("")
    setCategory("")
    setTechnician("")
    setPriority("")
    setVendor("")
    setSite("")
    router.push("/reports")
  }

  const exportHref = (format: "csv" | "xlsx" | "pdf") => {
    const params = buildParams()
    params.set("format", format)
    return `/api/reports/export?${params.toString()}`
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
      <FilterSelect label="Department" value={department} setValue={setDepartment} values={options.departments} />
      <FilterSelect label="Category" value={category} setValue={setCategory} values={options.categories} />
      <FilterSelect label="Priority" value={priority} setValue={setPriority} values={options.priorities} />
      <FilterSelect label="Vendor" value={vendor} setValue={setVendor} values={options.vendors} />
      <FilterSelect label="Site" value={site} setValue={setSite} values={options.sites} />
      <div>
        <Label htmlFor="report-technician" className="text-xs">Technician</Label>
        <select
          id="report-technician"
          value={technician}
          onChange={(event) => setTechnician(event.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All</option>
          {options.technicians.map((tech) => (
            <option key={tech.id} value={tech.id}>{tech.name}</option>
          ))}
        </select>
      </div>
      <Button size="sm" onClick={applyFilter}>Filter</Button>
      <Button size="sm" variant="outline" onClick={clearFilter}>Clear</Button>
      <div className="flex gap-2">
        {(["csv", "xlsx", "pdf"] as const).map((format) => (
          <a key={format} href={exportHref(format)} className={cn(buttonVariants({ size: "sm", variant: "outline" }))}>
            <Download className="mr-1 h-4 w-4" />
            {format.toUpperCase()}
          </a>
        ))}
      </div>
    </div>
  )
}

function FilterSelect({
  label,
  value,
  values,
  setValue,
}: {
  label: string
  value: string
  values: string[]
  setValue: (value: string) => void
}) {
  const id = `report-${label.toLowerCase()}`
  return (
    <div>
      <Label htmlFor={id} className="text-xs">{label}</Label>
      <select
        id={id}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="h-9 max-w-40 rounded-md border border-input bg-background px-3 text-sm"
      >
        <option value="">All</option>
        {values.map((item) => (
          <option key={item} value={item}>{item}</option>
        ))}
      </select>
    </div>
  )
}
