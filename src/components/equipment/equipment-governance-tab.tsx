import { recordCommissioning, recordCybersecurityAssessment, recordDecommissioning } from "@/lib/actions/asset-governance"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import type { CommissioningRecord, CybersecurityAssessment, DecommissioningRecord, Equipment } from "@/lib/types"

function fmt(value: string | null | undefined) {
  return value ? value.replaceAll("_", " ") : "none"
}

export function EquipmentGovernanceTab({
  equipment,
  cybersecurity,
  commissioning,
  decommissioning,
}: {
  equipment: Equipment
  cybersecurity: CybersecurityAssessment[]
  commissioning: CommissioningRecord[]
  decommissioning: DecommissioningRecord[]
}) {
  return (
    <div className="space-y-6">
      <section className="grid gap-3 md:grid-cols-3">
        <div className="rounded-md border p-3">
          <p className="text-xs font-medium uppercase text-muted-foreground">Cyber Risk</p>
          <p className="mt-1 font-medium capitalize">{fmt(equipment.risk_acceptance_status)}</p>
          <p className="text-xs text-muted-foreground">Patch: {fmt(equipment.patch_status)}</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-xs font-medium uppercase text-muted-foreground">Commissioning</p>
          <p className="mt-1 font-medium capitalize">{fmt(equipment.commissioning_status)}</p>
          <p className="text-xs text-muted-foreground">{equipment.commissioning_approved_at ? new Date(equipment.commissioning_approved_at).toLocaleString() : "No approval recorded"}</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-xs font-medium uppercase text-muted-foreground">Decommissioning</p>
          <p className="mt-1 font-medium capitalize">{fmt(equipment.decommissioning_status)}</p>
          <p className="text-xs text-muted-foreground">{equipment.decommissioned_at ? new Date(equipment.decommissioned_at).toLocaleString() : "Not decommissioned"}</p>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <form action={recordCybersecurityAssessment.bind(null, equipment.id)} className="space-y-3 rounded-md border p-4">
          <h3 className="font-medium">Cybersecurity Assessment</h3>
          <div>
            <Label htmlFor="assessment_status">Assessment Status</Label>
            <select id="assessment_status" name="assessment_status" className="h-10 w-full rounded-md border bg-background px-3 text-sm" defaultValue="pass">
              <option value="pass">Pass</option>
              <option value="monitor">Monitor</option>
              <option value="risk_acceptance_required">Risk Acceptance Required</option>
              <option value="fail">Fail</option>
            </select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="patch_status">Patch</Label>
              <select id="patch_status" name="patch_status" className="h-10 w-full rounded-md border bg-background px-3 text-sm" defaultValue={equipment.patch_status}>
                <option value="unknown">Unknown</option>
                <option value="current">Current</option>
                <option value="due">Due</option>
                <option value="overdue">Overdue</option>
                <option value="unsupported">Unsupported</option>
                <option value="risk_accepted">Risk Accepted</option>
              </select>
            </div>
            <div>
              <Label htmlFor="antivirus_status">AV/EDR</Label>
              <select id="antivirus_status" name="antivirus_status" className="h-10 w-full rounded-md border bg-background px-3 text-sm" defaultValue={equipment.antivirus_status}>
                <option value="not_applicable">N/A</option>
                <option value="enabled">Enabled</option>
                <option value="disabled">Disabled</option>
                <option value="outdated">Outdated</option>
                <option value="unsupported">Unsupported</option>
              </select>
            </div>
          </div>
          <div>
            <Label htmlFor="backup_status">Backup</Label>
            <select id="backup_status" name="backup_status" className="h-10 w-full rounded-md border bg-background px-3 text-sm" defaultValue={equipment.backup_status}>
              <option value="not_applicable">N/A</option>
              <option value="current">Current</option>
              <option value="stale">Stale</option>
              <option value="missing">Missing</option>
              <option value="failed">Failed</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="internet_exposed" defaultChecked={equipment.internet_exposed} /> Internet exposed</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="remote_access_enabled" defaultChecked={equipment.remote_access_enabled} /> Remote access enabled</label>
          <div>
            <Label htmlFor="vulnerabilities">Vulnerabilities</Label>
            <Textarea id="vulnerabilities" name="vulnerabilities" placeholder="One item per line or JSON array" />
          </div>
          <div>
            <Label htmlFor="assessment_notes">Assessment Notes</Label>
            <Textarea id="assessment_notes" name="assessment_notes" required />
          </div>
          <div>
            <Label htmlFor="risk_acceptance_reason">Risk Acceptance Reason</Label>
            <Textarea id="risk_acceptance_reason" name="risk_acceptance_reason" />
          </div>
          <div>
            <Label htmlFor="risk_acceptance_expires_at">Risk Acceptance Expires</Label>
            <Input id="risk_acceptance_expires_at" name="risk_acceptance_expires_at" type="date" />
          </div>
          <div>
            <Label htmlFor="cyber_reauth_password">Re-auth Password</Label>
            <Input id="cyber_reauth_password" name="reauth_password" type="password" />
          </div>
          <Button type="submit" className="w-full">Record Assessment</Button>
        </form>

        <form action={recordCommissioning.bind(null, equipment.id)} className="space-y-3 rounded-md border p-4">
          <h3 className="font-medium">Commissioning</h3>
          <div>
            <Label htmlFor="commissioning_status">Status</Label>
            <select id="commissioning_status" name="commissioning_status" className="h-10 w-full rounded-md border bg-background px-3 text-sm" defaultValue="acceptance_testing">
              <option value="pending_installation">Pending Installation</option>
              <option value="installed">Installed</option>
              <option value="acceptance_testing">Acceptance Testing</option>
              <option value="user_training">User Training</option>
              <option value="approved_for_service">Approved For Service</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="installation_verified" /> Installation verified</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="acceptance_test_passed" /> Acceptance test passed</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="user_training_completed" /> User training completed</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="handover_completed" /> Handover completed</label>
          <div>
            <Label htmlFor="commissioning_evidence_notes">Evidence Notes</Label>
            <Textarea id="commissioning_evidence_notes" name="evidence_notes" required />
          </div>
          <div>
            <Label htmlFor="commissioning_reauth_password">Re-auth Password</Label>
            <Input id="commissioning_reauth_password" name="reauth_password" type="password" />
          </div>
          <Button type="submit" className="w-full">Record Commissioning</Button>
        </form>

        <form action={recordDecommissioning.bind(null, equipment.id)} className="space-y-3 rounded-md border p-4">
          <h3 className="font-medium">Decommissioning</h3>
          <div>
            <Label htmlFor="disposal_method">Disposal Method</Label>
            <Input id="disposal_method" name="disposal_method" required />
          </div>
          <div>
            <Label htmlFor="data_sanitization_status">Data Sanitization</Label>
            <select id="data_sanitization_status" name="data_sanitization_status" className="h-10 w-full rounded-md border bg-background px-3 text-sm" defaultValue={equipment.network_connected ? "pending" : "not_applicable"}>
              <option value="not_applicable">N/A</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="accessories_recovered" /> Accessories recovered</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="hazardous_material_checked" /> Hazardous material checked</label>
          <div>
            <Label htmlFor="finance_approval_reference">Finance Approval Reference</Label>
            <Input id="finance_approval_reference" name="finance_approval_reference" />
          </div>
          <div>
            <Label htmlFor="final_location">Final Location</Label>
            <Input id="final_location" name="final_location" />
          </div>
          <div>
            <Label htmlFor="certificate_url">Certificate URL</Label>
            <Input id="certificate_url" name="certificate_url" type="url" />
          </div>
          <div>
            <Label htmlFor="decommissioning_evidence_notes">Evidence Notes</Label>
            <Textarea id="decommissioning_evidence_notes" name="evidence_notes" required />
          </div>
          <div>
            <Label htmlFor="decommissioning_reauth_password">Re-auth Password</Label>
            <Input id="decommissioning_reauth_password" name="reauth_password" type="password" required />
          </div>
          <Button type="submit" className="w-full" variant="outline">Complete Decommissioning</Button>
        </form>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <History title="Cybersecurity History" rows={cybersecurity.map((row) => ({
          id: row.id,
          badge: row.assessment_status,
          when: row.assessed_at,
          text: row.assessment_notes,
        }))} empty="No cybersecurity assessments recorded." />
        <History title="Commissioning History" rows={commissioning.map((row) => ({
          id: row.id,
          badge: row.commissioning_status,
          when: row.created_at,
          text: row.evidence_notes,
        }))} empty="No commissioning records recorded." />
        <History title="Decommissioning History" rows={decommissioning.map((row) => ({
          id: row.id,
          badge: row.data_sanitization_status,
          when: row.completed_at,
          text: `${row.disposal_method}: ${row.evidence_notes}`,
        }))} empty="No decommissioning records recorded." />
      </section>
    </div>
  )
}

function History({
  title,
  rows,
  empty,
}: {
  title: string
  rows: Array<{ id: string; badge: string; when: string; text: string }>
  empty: string
}) {
  return (
    <div className="rounded-md border p-4">
      <h3 className="font-medium">{title}</h3>
      <div className="mt-3 space-y-3">
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">{empty}</p> : rows.slice(0, 5).map((row) => (
          <div key={row.id} className="border-t pt-3 first:border-t-0 first:pt-0">
            <div className="flex items-center justify-between gap-2">
              <Badge variant="outline" className="capitalize">{fmt(row.badge)}</Badge>
              <span className="text-xs text-muted-foreground">{new Date(row.when).toLocaleString()}</span>
            </div>
            <p className="mt-2 text-sm">{row.text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
