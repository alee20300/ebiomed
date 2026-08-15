"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export type FilterOption = {
  value: string
  label: string
}

export function paginate<T>(items: T[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * pageSize

  return {
    page: safePage,
    totalPages,
    items: items.slice(start, start + pageSize),
    start,
  }
}

export function matchesQuery(values: Array<string | number | null | undefined>, query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return true
  return values.some((value) => String(value ?? "").toLowerCase().includes(normalizedQuery))
}

export function ListControls({
  filters,
  activeFilter,
  onFilterChange,
  query,
  onQueryChange,
  searchPlaceholder = "Search",
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}: {
  filters?: FilterOption[]
  activeFilter?: string
  onFilterChange?: (value: string) => void
  query?: string
  onQueryChange?: (value: string) => void
  searchPlaceholder?: string
  page: number
  totalPages: number
  totalItems: number
  pageSize: number
  onPageChange: (page: number) => void
}) {
  const start = totalItems === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, totalItems)

  return (
    <div className="space-y-3 rounded-lg border bg-card p-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        {onQueryChange && (
          <Input
            value={query || ""}
            onChange={(event) => {
              onQueryChange(event.target.value)
              onPageChange(1)
            }}
            placeholder={searchPlaceholder}
            className="h-9 lg:max-w-xs"
          />
        )}
        {filters && activeFilter && onFilterChange && (
          <div className="flex items-center gap-2 lg:ml-auto">
            <span className="text-xs font-medium text-muted-foreground">Filter</span>
            <Select
              value={activeFilter}
              onValueChange={(value) => {
                if (!value) return
                onFilterChange(value)
                onPageChange(1)
              }}
            >
              <SelectTrigger size="sm" className="w-44 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {filters.map((filter) => (
                  <SelectItem key={filter.value} value={filter.value}>
                    {filter.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{totalItems === 0 ? "No matching items" : `Showing ${start}-${end} of ${totalItems}`}</span>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 px-2 text-xs"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              Previous
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 px-2 text-xs"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
