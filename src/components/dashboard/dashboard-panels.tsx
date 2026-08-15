"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { AlertTriangle, CalendarClock, ClipboardList, FileWarning, Package, Wrench } from "lucide-react"
import { differenceInCalendarDays, formatDistanceToNowStrict, isPast, isToday } from "date-fns"

import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PriorityBadge } from "@/components/shared/priority-badge"
import { StatusBadge } from "@/components/shared/status-badge"
import { cn } from "@/lib/utils"
import { formatDate, getPMStatus, statusColor } from "@/lib/utils/format"
import type { Complaint, Contract, Equipment, Part, PMSchedule, WorkOrder } from "@/lib/types"

type DashboardEquipment = Pick<Equipment, "id" | "name" | "tag_number" | "department" | "location" | "status" | "asset_criticality">
type DashboardWorkOrder = WorkOrder & { equipment?: DashboardEquipment | null }
type DashboardPMSchedule = PMSchedule & { equipment?: DashboardEquipment | null }
type FilterOption = {
  value: string
  label: string
}
type CriticalAlert = {
  key: string
  severity: string
  title: string
  meta: string
  href: string
  action: string
  icon: typeof AlertTriangle
  tone: "danger" | "warning"
}

function dueLabel(date: string | null) {
  if (!date) return "No due date"
  const due = new Date(date)
  if (isToday(due)) return "Due today"
  if (isPast(due)) return `${formatDistanceToNowStrict(due)} overdue`
  const days = differenceInCalendarDays(due, new Date())
  return days === 1 ? "Due tomorrow" : `Due in ${days} days`
}

function daysUntil(date: string) {
  const diff = new Date(date).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function partStatus(part: Part) {
  const shortBy = Math.max(part.min_threshold - part.quantity_on_hand, 0)
  if (part.quantity_on_hand === 0) return { label: "Out of stock", detail: `Short by ${shortBy}`, tone: "danger" }
  if (part.quantity_on_hand < part.min_threshold) return { label: "Below minimum", detail: `Short by ${shortBy}`, tone: "danger" }
  if (part.quantity_on_hand === part.min_threshold) return { label: "At reorder level", detail: "Reorder recommended", tone: "warning" }
  return { label: "Sufficient", detail: "Above reorder level", tone: "success" }
}

function equipmentProblem(eq: DashboardEquipment) {
  if (eq.status === "under_repair") return "Under maintenance"
  if (eq.status === "out_of_tolerance") return "Out of tolerance"
  if (eq.status === "inactive") return "Unavailable"
  if (eq.status === "retired") return "Retired"
  return "Open work order"
}

function paginate<T>(items: T[], page: number, pageSize: number) {
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

function PanelControls({
  filters,
  activeFilter,
  onFilterChange,
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}: {
  filters: FilterOption[]
  activeFilter: string
  onFilterChange: (value: string) => void
  page: number
  totalPages: number
  totalItems: number
  pageSize: number
  onPageChange: (page: number) => void
}) {
  const start = totalItems === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, totalItems)

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {filters.map((filter) => (
          <Button
            key={filter.value}
            type="button"
            size="sm"
            variant={activeFilter === filter.value ? "default" : "outline"}
            className="h-7 shrink-0 px-2 text-xs"
            onClick={() => onFilterChange(filter.value)}
          >
            {filter.label}
          </Button>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{totalItems === 0 ? "No matching items" : `Showing ${start}-${end} of ${totalItems}`}</span>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              Previous
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
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

function CriticalAlerts({
  workOrders,
  pmSchedules,
  complaints,
  lowParts,
  contracts,
}: {
  workOrders: DashboardWorkOrder[]
  pmSchedules: DashboardPMSchedule[]
  complaints: Complaint[]
  lowParts: Part[]
  contracts: Contract[]
}) {
  const safety = complaints.find((request) => request.patient_safety_risk === "critical" || request.urgency === "emergency")
  const criticalWO = workOrders.find((wo) => wo.priority === "critical" && wo.status !== "completed" && wo.status !== "cancelled")
  const overduePM = pmSchedules.find((pm) => getPMStatus(pm.next_due) === "overdue" && pm.equipment?.asset_criticality === "life_support")
  const outOfStock = lowParts.find((part) => part.quantity_on_hand === 0)
  const expiringContract = contracts[0]
  const contractDays = expiringContract ? daysUntil(expiringContract.end_date) : null

  const alerts: CriticalAlert[] = [
    safety && {
      key: `request-${safety.id}`,
      severity: "Critical",
      title: `${safety.reference_number} has patient-safety risk`,
      meta: `${safety.reported_by_department || "Unknown department"} · ${safety.urgency} urgency`,
      href: `/complaints/${safety.id}`,
      action: "Review request",
      icon: AlertTriangle,
      tone: "danger",
    },
    criticalWO && {
      key: `wo-${criticalWO.id}`,
      severity: "Critical",
      title: `${criticalWO.equipment?.name || "Equipment"} needs immediate work`,
      meta: `${criticalWO.equipment?.location || criticalWO.equipment?.department || "No location"} · ${criticalWO.status.replace("_", " ")}`,
      href: `/work-orders/${criticalWO.id}`,
      action: "Open work order",
      icon: Wrench,
      tone: "danger",
    },
    overduePM && {
      key: `pm-${overduePM.id}`,
      severity: "High",
      title: `${overduePM.equipment?.name || "Life-support equipment"} PM is overdue`,
      meta: `${overduePM.equipment?.location || overduePM.equipment?.department || "No location"} · ${dueLabel(overduePM.next_due)}`,
      href: `/pm-schedules/${overduePM.id}`,
      action: "Open PM",
      icon: CalendarClock,
      tone: "warning",
    },
    outOfStock && {
      key: `part-${outOfStock.id}`,
      severity: "Warning",
      title: `${outOfStock.name} is out of stock`,
      meta: `${outOfStock.location || outOfStock.stock_location || "No stock location"} · Reorder level ${outOfStock.min_threshold}`,
      href: "/parts",
      action: "Request purchase",
      icon: Package,
      tone: "warning",
    },
    expiringContract && {
      key: `contract-${expiringContract.id}`,
      severity: contractDays !== null && contractDays < 0 ? "High" : "Warning",
      title: `${expiringContract.contract_type} ${expiringContract.title}`,
      meta: contractDays !== null && contractDays < 0 ? `${Math.abs(contractDays)}d expired` : `${contractDays}d left`,
      href: "/purchasing",
      action: "Review contract",
      icon: FileWarning,
      tone: "warning",
    },
  ].filter((alert): alert is CriticalAlert => Boolean(alert))

  if (alerts.length === 0) return null

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Critical alerts</h3>
        <span className="text-xs text-muted-foreground">{alerts.length} needs attention</span>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {alerts.slice(0, 4).map((alert) => {
          const Icon = alert.icon
          const danger = alert.tone === "danger"
          return (
            <Card key={alert.key} size="sm" className={danger ? "border-danger bg-danger-subtle" : "border-warning bg-warning-subtle"}>
              <CardContent className="flex items-start gap-3">
                <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", danger ? "text-danger-strong" : "text-warning-strong")} />
                <div className="min-w-0 flex-1">
                  <Badge className={danger ? "bg-danger text-white" : "bg-warning text-white"}>{alert.severity}</Badge>
                  <p className={cn("mt-2 font-medium leading-snug", danger ? "text-danger-strong" : "text-warning-strong")}>{alert.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{alert.meta}</p>
                </div>
                <Link href={alert.href} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0 bg-card")}>
                  {alert.action}
                </Link>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </section>
  )
}

function MyTasksPanel({ workOrders }: { workOrders: DashboardWorkOrder[] }) {
  const pageSize = 5
  const [filter, setFilter] = useState("active")
  const [page, setPage] = useState(1)
  const filters = [
    { value: "active", label: "Active" },
    { value: "critical", label: "Critical" },
    { value: "open", label: "Open" },
    { value: "in_progress", label: "In Progress" },
    { value: "on_hold", label: "On Hold" },
  ]
  const filtered = useMemo(() => {
    if (filter === "critical") return workOrders.filter((wo) => wo.priority === "critical" || wo.priority === "high")
    if (filter === "active") return workOrders.filter((wo) => wo.status !== "completed" && wo.status !== "cancelled")
    return workOrders.filter((wo) => wo.status === filter)
  }, [filter, workOrders])
  const pageData = paginate(filtered, page, pageSize)

  return (
    <Card size="sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>My Tasks</CardTitle>
        <Badge variant="outline">{workOrders.length}</Badge>
      </CardHeader>
      <CardContent className="space-y-2">
        {workOrders.length === 0 ? (
          <div className="rounded-lg border bg-muted p-4 text-sm text-muted-foreground">
            No assigned tasks. Check unassigned work orders or scan equipment to start work.
          </div>
        ) : (
          <>
            <PanelControls
              filters={filters}
              activeFilter={filter}
              onFilterChange={(value) => { setFilter(value); setPage(1) }}
              page={pageData.page}
              totalPages={pageData.totalPages}
              totalItems={filtered.length}
              pageSize={pageSize}
              onPageChange={setPage}
            />
            {pageData.items.map((wo) => (
              <div key={wo.id} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">WO-{wo.id.slice(0, 8)}</p>
                    <p className="truncate text-xs text-muted-foreground">{wo.description}</p>
                  </div>
                  <PriorityBadge priority={wo.priority} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {wo.equipment?.name || "Unknown equipment"} · {wo.equipment?.tag_number || "No asset tag"} · {wo.equipment?.location || wo.equipment?.department || "No location"}
                </p>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <StatusBadge status={wo.status} />
                  <Link href={`/work-orders/${wo.id}`} className={cn(buttonVariants({ size: "sm" }))}>
                    {wo.status === "open" ? "Start work" : "Continue"}
                  </Link>
                </div>
              </div>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function UpcomingPMPanel({ schedules }: { schedules: DashboardPMSchedule[] }) {
  const pageSize = 5
  const [filter, setFilter] = useState("all")
  const [page, setPage] = useState(1)
  const filters = [
    { value: "all", label: "All" },
    { value: "overdue", label: "Overdue" },
    { value: "today", label: "Today" },
    { value: "life_support", label: "Life Support" },
  ]
  const filtered = useMemo(() => {
    if (filter === "overdue") return schedules.filter((pm) => getPMStatus(pm.next_due) === "overdue")
    if (filter === "today") return schedules.filter((pm) => pm.next_due && isToday(new Date(pm.next_due)))
    if (filter === "life_support") return schedules.filter((pm) => pm.equipment?.asset_criticality === "life_support")
    return schedules
  }, [filter, schedules])
  const pageData = paginate(filtered, page, pageSize)

  return (
    <Card size="sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Upcoming PMs</CardTitle>
        <Badge variant="outline">Next 30 days</Badge>
      </CardHeader>
      <CardContent className="space-y-2">
        {schedules.length === 0 ? (
          <div className="rounded-lg border bg-muted p-4 text-sm text-muted-foreground">No PMs due in the next 7 days.</div>
        ) : (
          <>
            <PanelControls
              filters={filters}
              activeFilter={filter}
              onFilterChange={(value) => { setFilter(value); setPage(1) }}
              page={pageData.page}
              totalPages={pageData.totalPages}
              totalItems={filtered.length}
              pageSize={pageSize}
              onPageChange={setPage}
            />
            {pageData.items.map((pm) => {
              const status = getPMStatus(pm.next_due)
              return (
                <div key={pm.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{pm.equipment?.name || "Unknown equipment"}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {pm.equipment?.tag_number || "No asset tag"} · {pm.equipment?.location || pm.equipment?.department || "No location"} · Every {pm.frequency_days} days
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <Badge className={statusColor(status)}>{dueLabel(pm.next_due)}</Badge>
                    <Link href={`/pm-schedules/${pm.id}`} className="mt-1 block text-xs font-medium text-primary">Open</Link>
                  </div>
                </div>
              )
            })}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function EquipmentAttentionPanel({ equipment }: { equipment: DashboardEquipment[] }) {
  const pageSize = 5
  const [filter, setFilter] = useState("all")
  const [page, setPage] = useState(1)
  const filters = [
    { value: "all", label: "All" },
    { value: "under_repair", label: "Repair" },
    { value: "out_of_tolerance", label: "Tolerance" },
    { value: "inactive", label: "Inactive" },
    { value: "life_support", label: "Life Support" },
  ]
  const filtered = useMemo(() => {
    if (filter === "life_support") return equipment.filter((eq) => eq.asset_criticality === "life_support")
    if (filter === "all") return equipment
    return equipment.filter((eq) => eq.status === filter)
  }, [equipment, filter])
  const pageData = paginate(filtered, page, pageSize)

  return (
    <Card size="sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Equipment Needing Attention</CardTitle>
        <Link href="/equipment" className="text-xs font-medium text-primary">View all</Link>
      </CardHeader>
      <CardContent className="space-y-2">
        {equipment.length === 0 ? (
          <div className="rounded-lg border bg-muted p-4 text-sm text-muted-foreground">No equipment currently needs attention.</div>
        ) : (
          <>
            <PanelControls
              filters={filters}
              activeFilter={filter}
              onFilterChange={(value) => { setFilter(value); setPage(1) }}
              page={pageData.page}
              totalPages={pageData.totalPages}
              totalItems={filtered.length}
              pageSize={pageSize}
              onPageChange={setPage}
            />
            {pageData.items.map((eq) => (
              <div key={eq.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{eq.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{eq.tag_number} · {eq.location || eq.department || "No location"}</p>
                </div>
                <div className="shrink-0 text-right">
                  <Badge className={statusColor(eq.status)}>{equipmentProblem(eq)}</Badge>
                  <Link href={`/equipment/${eq.id}`} className="mt-1 block text-xs font-medium text-primary">View</Link>
                </div>
              </div>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function LowPartsPanel({ parts }: { parts: Part[] }) {
  const pageSize = 5
  const [filter, setFilter] = useState("all")
  const [page, setPage] = useState(1)
  const filters = [
    { value: "all", label: "All" },
    { value: "out", label: "Out" },
    { value: "below", label: "Below Min" },
    { value: "reorder", label: "Reorder" },
  ]
  const filtered = useMemo(() => {
    if (filter === "out") return parts.filter((part) => part.quantity_on_hand === 0)
    if (filter === "below") return parts.filter((part) => part.quantity_on_hand > 0 && part.quantity_on_hand < part.min_threshold)
    if (filter === "reorder") return parts.filter((part) => part.quantity_on_hand === part.min_threshold)
    return parts
  }, [filter, parts])
  const pageData = paginate(filtered, page, pageSize)

  return (
    <Card size="sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Low & Reorder-Level Parts</CardTitle>
        <Link href="/parts" className="text-xs font-medium text-primary">View all</Link>
      </CardHeader>
      <CardContent className="space-y-2">
        {parts.length === 0 ? (
          <div className="rounded-lg border bg-muted p-4 text-sm text-muted-foreground">All tracked parts are above reorder level.</div>
        ) : (
          <>
            <PanelControls
              filters={filters}
              activeFilter={filter}
              onFilterChange={(value) => { setFilter(value); setPage(1) }}
              page={pageData.page}
              totalPages={pageData.totalPages}
              totalItems={filtered.length}
              pageSize={pageSize}
              onPageChange={setPage}
            />
            {pageData.items.map((part) => {
              const status = partStatus(part)
              return (
                <div key={part.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{part.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{part.quantity_on_hand} available · Reorder level {part.min_threshold}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <Badge className={statusColor(status.tone)}>{status.label}</Badge>
                    <p className="mt-1 text-xs text-muted-foreground">{status.detail}</p>
                  </div>
                </div>
              )
            })}
          </>
        )}
      </CardContent>
    </Card>
  )
}

export function DashboardOperations({
  myTasks,
  upcomingPMs,
  attentionEquipment,
  lowParts,
  criticalWorkOrders,
  complaints,
  contracts,
}: {
  myTasks: DashboardWorkOrder[]
  upcomingPMs: DashboardPMSchedule[]
  attentionEquipment: DashboardEquipment[]
  lowParts: Part[]
  criticalWorkOrders: DashboardWorkOrder[]
  complaints: Complaint[]
  contracts: Contract[]
}) {
  return (
    <>
      <CriticalAlerts workOrders={criticalWorkOrders} pmSchedules={upcomingPMs} complaints={complaints} lowParts={lowParts} contracts={contracts} />
      <div className="grid gap-4 xl:grid-cols-2">
        <MyTasksPanel workOrders={myTasks} />
        <UpcomingPMPanel schedules={upcomingPMs} />
        <EquipmentAttentionPanel equipment={attentionEquipment} />
        <LowPartsPanel parts={lowParts} />
      </div>
    </>
  )
}
