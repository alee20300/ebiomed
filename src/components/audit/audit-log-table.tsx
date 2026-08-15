"use client"

import { useState, useEffect, useCallback } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ChevronLeft, ChevronRight, Download } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { getAuditLog, exportAuditLog } from "@/lib/actions/audit"
import { statusColor } from "@/lib/utils/format"

interface AuditEntry {
  id: string
  table_name: string
  record_id: string
  action: "insert" | "update" | "delete"
  field_name: string | null
  old_value: string | null
  new_value: string | null
  changed_by: string
  changed_at: string
  reason: string
  profile?: { full_name: string; role: string } | null
}

const PAGE_SIZE = 25

export function AuditLogTable() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [tableFilter, setTableFilter] = useState("")
  const [actionFilter, setActionFilter] = useState("")
  const [recordFilter, setRecordFilter] = useState("")

  const handleTableFilterChange = useCallback((v: string | null) => {
    if (!v) return
    setTableFilter(v === "all" ? "" : v)
    setOffset(0)
  }, [])

  const handleActionFilterChange = useCallback((v: string | null) => {
    if (!v) return
    setActionFilter(v === "all" ? "" : v)
    setOffset(0)
  }, [])

  const handleRecordFilterChange = useCallback((v: string) => {
    setRecordFilter(v)
    setOffset(0)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      const result = await getAuditLog({
        tableName: tableFilter || undefined,
        action: actionFilter || undefined,
        recordId: recordFilter || undefined,
        offset,
        limit: PAGE_SIZE,
      })
      if (!cancelled) {
        setEntries(result.entries as AuditEntry[])
        setHasMore(result.entries.length === PAGE_SIZE)
        setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [tableFilter, actionFilter, recordFilter, offset])

  const handleExport = async () => {
    const data = await exportAuditLog({
      tableName: tableFilter || undefined,
      action: actionFilter || undefined,
      recordId: recordFilter || undefined,
    })

    const csv = [
      ["Timestamp", "Table", "Record ID", "Action", "Field", "Old Value", "New Value", "User", "Reason"].join(","),
      ...data.map((e: AuditEntry) =>
        [e.changed_at, e.table_name, e.record_id, e.action, e.field_name || "", e.old_value || "", e.new_value || "", e.profile?.full_name || "Unknown", `"${(e.reason || "").replace(/"/g, '""')}"`].join(",")
      ),
    ].join("\n")

    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Audit Trail</CardTitle>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-wrap gap-3">
          <div className="w-40">
            <Select value={tableFilter} onValueChange={handleTableFilterChange}>
              <SelectTrigger>
                <SelectValue placeholder="All tables" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tables</SelectItem>
                <SelectItem value="equipment">Equipment</SelectItem>
                <SelectItem value="work_orders">Work Orders</SelectItem>
                <SelectItem value="pm_schedules">PM Schedules</SelectItem>
                <SelectItem value="parts">Parts</SelectItem>
                <SelectItem value="parts_usage">Parts Usage</SelectItem>
                <SelectItem value="wo_comments">Comments</SelectItem>
                <SelectItem value="profiles">Profiles</SelectItem>
                <SelectItem value="departments">Departments</SelectItem>
                <SelectItem value="checklist_templates">Checklist Templates</SelectItem>
                <SelectItem value="checklist_submissions">Checklist Submissions</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-32">
            <Select value={actionFilter} onValueChange={handleActionFilterChange}>
              <SelectTrigger>
                <SelectValue placeholder="All actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                <SelectItem value="insert">Insert</SelectItem>
                <SelectItem value="update">Update</SelectItem>
                <SelectItem value="delete">Delete</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Input
            placeholder="Record ID"
            value={recordFilter}
            onChange={(e) => handleRecordFilterChange(e.target.value)}
            className="w-80"
          />
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No audit entries found.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[160px]">Timestamp</TableHead>
                    <TableHead>Table</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Field</TableHead>
                    <TableHead className="max-w-[200px]">Old → New</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead className="max-w-[250px]">Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {format(new Date(entry.changed_at), "yyyy-MM-dd HH:mm:ss")}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{entry.table_name}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs capitalize",
                            statusColor(entry.action)
                          )}
                        >
                          {entry.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {entry.field_name || <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-xs">
                        {entry.old_value || entry.new_value ? (
                          <div className="max-w-[200px] truncate">
                            {entry.old_value && (
                              <span className="text-danger-strong line-through">{truncate(entry.old_value, 50)}</span>
                            )}
                            {entry.old_value && entry.new_value && (
                              <span className="mx-1 text-muted-foreground">→</span>
                            )}
                            {entry.new_value && (
                              <span className="text-success-strong">{truncate(entry.new_value, 50)}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {entry.profile?.full_name || "System"}
                      </TableCell>
                      <TableCell className="max-w-[250px] truncate text-xs" title={entry.reason}>
                        {entry.reason}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Previous
              </Button>
              <span className="text-xs text-muted-foreground">
                Showing {offset + 1}–{offset + entries.length}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={!hasMore}
                onClick={() => setOffset(offset + PAGE_SIZE)}
              >
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function truncate(text: string, max: number): string {
  try {
    const obj = JSON.parse(text)
    return JSON.stringify(obj).slice(0, max) + (JSON.stringify(obj).length > max ? "..." : "")
  } catch {
    return text.slice(0, max) + (text.length > max ? "..." : "")
  }
}
