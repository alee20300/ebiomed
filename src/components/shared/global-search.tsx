"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { ClipboardList, FileText, Package, Search, Stethoscope, Wrench } from "lucide-react"

type SearchKind = "equipment" | "work_order" | "request" | "pm" | "part"

interface SearchResult {
  id: string
  kind: SearchKind
  label: string
  identifier: string
  meta: string
  status?: string | null
  href: string
  searchText: string
}

const GROUP_LABELS: Record<SearchKind, string> = {
  equipment: "Equipment",
  work_order: "Work orders",
  request: "Requests",
  pm: "PM schedules",
  part: "Parts",
}

const GROUP_ICONS = {
  equipment: Stethoscope,
  work_order: Wrench,
  request: ClipboardList,
  pm: FileText,
  part: Package,
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
}

function sqlTerm(value: string) {
  return value.replace(/[,%()]/g, " ").trim()
}

function fuzzyScore(query: string, text: string) {
  const q = normalize(query)
  const t = normalize(text)
  if (!q || !t) return 0
  if (t === q) return 120
  if (t.includes(q)) return 100 - Math.min(t.indexOf(q), 40)

  let qi = 0
  for (let ti = 0; ti < t.length && qi < q.length; ti += 1) {
    if (t[ti] === q[qi]) qi += 1
  }
  const sequential = qi === q.length ? 45 : 0
  const wordHits = q.split(" ").filter((word) => word && t.includes(word)).length * 15
  return sequential + wordHits
}

function resultScore(query: string, result: SearchResult) {
  return Math.max(
    fuzzyScore(query, result.identifier),
    fuzzyScore(query, result.label),
    fuzzyScore(query, result.meta),
    fuzzyScore(query, result.searchText)
  )
}

function flattenGroups(groups: Array<[SearchKind, SearchResult[]]>) {
  return groups.flatMap(([, results]) => results)
}

export function GlobalSearch({
  className,
  inputClassName,
  placeholder = "Search equipment, work orders, requests, PMs, parts or location...",
  size = "default",
}: {
  className?: string
  inputClassName?: string
  placeholder?: string
  size?: "default" | "compact"
}) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const trimmedQuery = query.trim()

  useEffect(() => {
    if (trimmedQuery.length < 2) {
      return
    }

    let cancelled = false
    const timer = setTimeout(async () => {
      setLoading(true)
      const term = sqlTerm(trimmedQuery)
      const like = `%${term}%`

      const [
        equipment,
        workOrders,
        requests,
        parts,
        pmSchedules,
      ] = await Promise.all([
        supabase
          .from("equipment")
          .select("id, name, tag_number, serial_number, department, location, status")
          .or(`name.ilike.${like},tag_number.ilike.${like},serial_number.ilike.${like},department.ilike.${like},location.ilike.${like},manufacturer.ilike.${like},model.ilike.${like}`)
          .limit(16),
        supabase
          .from("work_orders")
          .select("id, description, status, priority, created_at, equipment(name, tag_number, department, location)")
          .or(`description.ilike.${like},failure_mode.ilike.${like},root_cause.ilike.${like}`)
          .limit(12),
        supabase
          .from("complaints")
          .select("id, reference_number, description, request_status, urgency, reported_by_department, equipment(name, tag_number, location)")
          .or(`reference_number.ilike.${like},description.ilike.${like},reported_by_department.ilike.${like},reported_by_name.ilike.${like}`)
          .limit(12),
        supabase
          .from("parts")
          .select("id, name, part_number, quantity_on_hand, min_threshold, location, stock_location, bin_code, supplier")
          .or(`name.ilike.${like},part_number.ilike.${like},location.ilike.${like},stock_location.ilike.${like},bin_code.ilike.${like},supplier.ilike.${like}`)
          .limit(12),
        supabase
          .from("pm_schedules")
          .select("id, description, next_due, active, equipment(name, tag_number, department, location)")
          .or(`description.ilike.${like}`)
          .limit(12),
      ])

      if (cancelled) return

      const mapped: SearchResult[] = [
        ...((equipment.data || []) as Array<{
          id: string
          name: string
          tag_number: string
          serial_number: string | null
          department: string | null
          location: string | null
          status: string
        }>).map((item) => ({
          id: item.id,
          kind: "equipment" as const,
          label: item.name,
          identifier: item.tag_number,
          meta: [item.department, item.location, item.serial_number].filter(Boolean).join(" · ") || "No location",
          status: item.status,
          href: `/equipment/${item.id}`,
          searchText: [item.name, item.tag_number, item.serial_number, item.department, item.location, item.status].filter(Boolean).join(" "),
        })),
        ...((workOrders.data || []) as Array<{
          id: string
          description: string
          status: string
          priority: string
          equipment?: { name?: string | null; tag_number?: string | null; department?: string | null; location?: string | null } | null
        }>).map((item) => ({
          id: item.id,
          kind: "work_order" as const,
          label: item.description,
          identifier: `WO-${item.id.slice(0, 8)}`,
          meta: [item.equipment?.name, item.equipment?.tag_number, item.equipment?.location || item.equipment?.department, item.priority].filter(Boolean).join(" · "),
          status: item.status,
          href: `/work-orders/${item.id}`,
          searchText: [item.id, item.description, item.status, item.priority, item.equipment?.name, item.equipment?.tag_number, item.equipment?.department, item.equipment?.location].filter(Boolean).join(" "),
        })),
        ...((requests.data || []) as Array<{
          id: string
          reference_number: string
          description: string
          request_status: string
          urgency: string
          reported_by_department: string | null
          equipment?: { name?: string | null; tag_number?: string | null; location?: string | null } | null
        }>).map((item) => ({
          id: item.id,
          kind: "request" as const,
          label: item.description,
          identifier: item.reference_number,
          meta: [item.reported_by_department, item.equipment?.name, item.equipment?.tag_number, item.urgency].filter(Boolean).join(" · "),
          status: item.request_status,
          href: `/complaints/${item.id}`,
          searchText: [item.reference_number, item.description, item.request_status, item.urgency, item.reported_by_department, item.equipment?.name, item.equipment?.tag_number].filter(Boolean).join(" "),
        })),
        ...((pmSchedules.data || []) as Array<{
          id: string
          description: string | null
          next_due: string | null
          active: boolean
          equipment?: { name?: string | null; tag_number?: string | null; department?: string | null; location?: string | null } | null
        }>).map((item) => ({
          id: item.id,
          kind: "pm" as const,
          label: item.description || "Preventive maintenance",
          identifier: item.equipment?.tag_number || `PM-${item.id.slice(0, 8)}`,
          meta: [item.equipment?.name, item.equipment?.location || item.equipment?.department, item.next_due ? new Date(item.next_due).toLocaleDateString() : null].filter(Boolean).join(" · "),
          status: item.active ? "active" : "inactive",
          href: `/pm-schedules/${item.id}`,
          searchText: [item.id, item.description, item.equipment?.name, item.equipment?.tag_number, item.equipment?.department, item.equipment?.location].filter(Boolean).join(" "),
        })),
        ...((parts.data || []) as Array<{
          id: string
          name: string
          part_number: string | null
          quantity_on_hand: number
          min_threshold: number
          location: string | null
          stock_location: string | null
          bin_code: string | null
          supplier: string | null
        }>).map((item) => ({
          id: item.id,
          kind: "part" as const,
          label: item.name,
          identifier: item.part_number || "No part number",
          meta: `${item.quantity_on_hand} on hand · Min ${item.min_threshold}${item.stock_location || item.location ? ` · ${item.stock_location || item.location}` : ""}`,
          status: item.quantity_on_hand <= item.min_threshold ? "reorder" : "available",
          href: "/parts",
          searchText: [item.name, item.part_number, item.location, item.stock_location, item.bin_code, item.supplier].filter(Boolean).join(" "),
        })),
      ]

      const ranked = mapped
        .map((result) => ({ result, score: resultScore(trimmedQuery, result) }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((item) => item.result)
        .slice(0, 24)

      setResults(ranked)
      setActiveIndex(0)
      setOpen(true)
      setLoading(false)
    }, 180)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [trimmedQuery, supabase])

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const grouped = useMemo(() => {
    const order: SearchKind[] = ["equipment", "work_order", "request", "pm", "part"]
    return order
      .map((kind) => [kind, results.filter((result) => result.kind === kind)] as [SearchKind, SearchResult[]])
      .filter(([, groupResults]) => groupResults.length > 0)
  }, [results])

  const flatResults = useMemo(() => flattenGroups(grouped), [grouped])

  function selectResult(result: SearchResult) {
    setQuery("")
    setResults([])
    setOpen(false)
    router.push(result.href)
  }

  function handleQueryChange(value: string) {
    setQuery(value)
    if (value.trim().length < 2) {
      setResults([])
      setOpen(false)
      setLoading(false)
    }
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <Search className={cn("absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground", size === "compact" ? "h-3.5 w-3.5" : "h-4 w-4")} />
        <Input
          aria-label="Global fuzzy search"
          value={query}
          onChange={(event) => handleQueryChange(event.target.value)}
          onFocus={() => trimmedQuery.length >= 2 && setOpen(true)}
          onKeyDown={(event) => {
            if (!open || flatResults.length === 0) return
            if (event.key === "ArrowDown") {
              event.preventDefault()
              setActiveIndex((index) => (index + 1) % flatResults.length)
            }
            if (event.key === "ArrowUp") {
              event.preventDefault()
              setActiveIndex((index) => (index - 1 + flatResults.length) % flatResults.length)
            }
            if (event.key === "Enter") {
              event.preventDefault()
              selectResult(flatResults[activeIndex])
            }
            if (event.key === "Escape") {
              setOpen(false)
            }
          }}
          placeholder={placeholder}
          className={cn("bg-card pl-9", size === "compact" && "h-8 text-xs", inputClassName)}
        />
      </div>

      {open && trimmedQuery.length >= 2 && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border bg-card shadow-lg">
          {loading ? (
            <div className="p-4 text-sm text-muted-foreground">Searching...</div>
          ) : grouped.length > 0 ? (
            <div className="max-h-[420px] overflow-y-auto py-1">
              {grouped.map(([kind, groupResults]) => {
                const Icon = GROUP_ICONS[kind]
                return (
                  <div key={kind}>
                    <div className="flex items-center gap-2 border-b border-t px-3 py-1.5 first:border-t-0">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium uppercase text-muted-foreground">{GROUP_LABELS[kind]}</span>
                    </div>
                    {groupResults.map((result) => {
                      const index = flatResults.findIndex((item) => item.id === result.id && item.kind === result.kind)
                      return (
                        <button
                          key={`${result.kind}-${result.id}`}
                          type="button"
                          onMouseEnter={() => setActiveIndex(index)}
                          onClick={() => selectResult(result)}
                          className={cn(
                            "flex w-full items-start justify-between gap-3 px-3 py-2 text-left hover:bg-muted/50",
                            activeIndex === index && "bg-muted"
                          )}
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{result.label}</p>
                            <p className="truncate text-xs text-muted-foreground">{result.identifier} · {result.meta}</p>
                          </div>
                          {result.status && (
                            <Badge variant="outline" className="shrink-0 capitalize">
                              {result.status.replace("_", " ")}
                            </Badge>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No results found. Try an asset tag, WO text, request number, part number, department, or location.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
