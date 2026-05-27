import { AuditLogTable } from "@/components/audit/audit-log-table"

export default function AuditLogPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">Audit Log</h2>
      <p className="text-sm text-muted-foreground">
        Immutable, append-only record of all changes in the system. Required by FDA 21 CFR Part 11.
      </p>
      <AuditLogTable />
    </div>
  )
}
