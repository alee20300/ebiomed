"use client"

import { useState } from "react"
import { EquipmentForm } from "@/components/equipment/equipment-form"
import { StatusBadge } from "@/components/shared/status-badge"
import { MobileDisclosureSection } from "@/components/shared/mobile-disclosure-section"
import { formatDate } from "@/lib/utils/format"
import { calculateCurrentValue, calculateRiskScore, getAssetAgeYears, getReplacementRecommendation, getRiskBand, getUsefulLifeEndDate, type AssetServiceSummary } from "@/lib/utils/asset-lifecycle"
import { Button } from "@/components/ui/button"
import { refreshEquipmentLifecycle } from "@/lib/actions/equipment"
import { Pencil } from "lucide-react"
import type { Equipment } from "@/lib/types"

function formatTriggerType(triggerType: Equipment["pm_trigger_type"]) {
  return triggerType.replaceAll("_", " ")
}

function formatLabel(value: string | null | undefined) {
  return value ? value.replaceAll("_", " ") : "—"
}

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined) return "—"
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value))
}

function Field({
  label,
  children,
  wide = false,
}: {
  label: string
  children: React.ReactNode
  wide?: boolean
}) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <div className="break-words">{children}</div>
    </div>
  )
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>
}

export function EquipmentInfoTab({
  equipment,
  serviceSummary,
  labelTools,
  hierarchy,
}: {
  equipment: Equipment
  serviceSummary?: AssetServiceSummary
  labelTools?: React.ReactNode
  hierarchy?: React.ReactNode
}) {
  const [editing, setEditing] = useState(false)
  const riskScore = calculateRiskScore(equipment)
  const recommendation = getReplacementRecommendation(equipment, serviceSummary)
  const ageYears = getAssetAgeYears(equipment)
  const usefulLifeEnd = getUsefulLifeEndDate(equipment)
  const currentValue = calculateCurrentValue(equipment)

  if (editing) {
    return (
      <EquipmentForm equipment={equipment} onCancel={() => setEditing(false)} hideCancel />
    )
  }

  const replacementReasons = (equipment.replacement_recommendation_reasons?.length ? equipment.replacement_recommendation_reasons : recommendation.reasons).join(", ")

  const essentialFields = (
    <FieldGrid>
      <Field label="Tag Number">{equipment.tag_number}</Field>
      <Field label="Name">{equipment.name}</Field>
      <Field label="Department">{equipment.department || "—"}</Field>
      <Field label="Location">{equipment.location || "—"}</Field>
      <Field label="Status"><StatusBadge status={equipment.status} /></Field>
      <Field label="Asset Criticality"><span className="capitalize">{formatLabel(equipment.asset_criticality)}</span></Field>
      <Field label="Serial Number">{equipment.serial_number || "—"}</Field>
      <Field label="Model">{equipment.model || "—"}</Field>
      <Field label="Manufacturer">{equipment.manufacturer || "—"}</Field>
      <Field label="Category">{equipment.category || "—"}</Field>
      <Field label="Install Date">{formatDate(equipment.install_date)}</Field>
      <Field label="Warranty Expiry">{formatDate(equipment.warranty_expiry)}</Field>
    </FieldGrid>
  )

  const lifecycleFields = (
    <FieldGrid>
      <Field label="Device Category">{equipment.device_category || "—"}</Field>
      <Field label="Regulatory Risk Class"><span className="uppercase">{formatLabel(equipment.risk_class)}</span></Field>
      <Field label="Ownership Type"><span className="capitalize">{formatLabel(equipment.ownership_type)}</span></Field>
      <Field label="Cost Center">{equipment.cost_center || "—"}</Field>
      <Field label="Clinical Area">{equipment.clinical_area || "—"}</Field>
      <Field label="Manufacturer Device ID">{equipment.manufacturer_device_id || "—"}</Field>
      <Field label="Acquisition Date">{formatDate(equipment.acquisition_date)}</Field>
      <Field label="Asset Age">{ageYears === null ? "—" : `${ageYears.toFixed(1)} years`}</Field>
      <Field label="Purchase Cost">{formatMoney(equipment.purchase_cost)}</Field>
      <Field label="Current Value">{formatMoney(equipment.calculated_current_value ?? currentValue)}</Field>
      <Field label="Expected Life">{equipment.expected_life_years ? `${equipment.expected_life_years} years` : "—"}</Field>
      <Field label="Useful Life Ends">{usefulLifeEnd ? formatDate(usefulLifeEnd.toISOString()) : "—"}</Field>
      <Field label="Depreciation Method"><span className="capitalize">{equipment.depreciation_method?.replaceAll("_", " ") || "—"}</span></Field>
      <Field label="Lifecycle Stage"><span className="capitalize">{equipment.lifecycle_stage?.replaceAll("_", " ") || "—"}</span></Field>
      <Field label="Replacement Target">{formatDate(equipment.replacement_target_date)}</Field>
      <Field label="Replacement Due">{formatDate(equipment.replacement_due_date)}</Field>
      <Field label="Acceptance Test">{formatDate(equipment.acceptance_test_date)}</Field>
      <Field label="Commissioned">{formatDate(equipment.commissioned_at)}</Field>
      <Field label="Support Expiry">{formatDate(equipment.support_expiry)}</Field>
      {equipment.retirement_reason && <Field label="Retirement Reason" wide>{equipment.retirement_reason}</Field>}
      <Field label="Risk Score">{equipment.lifecycle_risk_score ?? riskScore}/100 · {equipment.lifecycle_risk_band || getRiskBand(riskScore)}</Field>
      <Field label="Service Cost">{formatMoney(equipment.service_cost_to_date || serviceSummary?.serviceCost || 0)}</Field>
      <Field label="Downtime To Date">{equipment.downtime_minutes_to_date || serviceSummary?.downtimeMinutes || 0} minutes</Field>
      <Field label="Lifecycle Reviewed">{equipment.lifecycle_reviewed_at ? new Date(equipment.lifecycle_reviewed_at).toLocaleString() : "—"}</Field>
      <Field label="Replacement Recommendation" wide>
        <p>{equipment.replacement_recommendation_label || recommendation.label}</p>
        <p className="text-xs text-muted-foreground">{replacementReasons}</p>
      </Field>
    </FieldGrid>
  )

  const usageFields = (
    <FieldGrid>
      <Field label="Run Hours">{equipment.run_hours ?? 0}</Field>
      <Field label="Cycle Count">{equipment.cycle_count ?? 0}</Field>
      <Field label="PM Trigger Type"><span className="capitalize">{formatTriggerType(equipment.pm_trigger_type || "calendar")}</span></Field>
      <Field label="PM Trigger Threshold">{equipment.pm_trigger_value ?? "—"}</Field>
    </FieldGrid>
  )

  const cyberFields = (
    <FieldGrid>
      <Field label="Network Connected">{equipment.network_connected ? "Yes" : "No"}</Field>
      <Field label="IP Address">{equipment.ip_address || "—"}</Field>
      <Field label="MAC Address">{equipment.mac_address || "—"}</Field>
      <Field label="Software Version">{equipment.software_version || "—"}</Field>
      <Field label="Firmware Version">{equipment.firmware_version || "—"}</Field>
      <Field label="OS / Platform">{equipment.os_platform || "—"}</Field>
      <Field label="Network Zone">{equipment.network_zone || "—"}</Field>
      <Field label="Patch Status"><span className="capitalize">{formatLabel(equipment.patch_status)}</span></Field>
      <Field label="Antivirus Status"><span className="capitalize">{formatLabel(equipment.antivirus_status)}</span></Field>
      <Field label="Backup Status"><span className="capitalize">{formatLabel(equipment.backup_status)}</span></Field>
      <Field label="Cyber Risk Acceptance"><span className="capitalize">{formatLabel(equipment.risk_acceptance_status)}</span></Field>
      <Field label="Risk Acceptance Expires">{formatDate(equipment.risk_acceptance_expires_at)}</Field>
      <Field label="Internet Exposed">{equipment.internet_exposed ? "Yes" : "No"}</Field>
      <Field label="Remote Access">{equipment.remote_access_enabled ? "Enabled" : "Disabled"}</Field>
    </FieldGrid>
  )

  const governanceFields = (
    <FieldGrid>
      <Field label="Commissioning Status"><span className="capitalize">{formatLabel(equipment.commissioning_status)}</span></Field>
      <Field label="Decommissioning Status"><span className="capitalize">{formatLabel(equipment.decommissioning_status)}</span></Field>
      {equipment.notes && <Field label="Notes" wide><p className="whitespace-pre-wrap">{equipment.notes}</p></Field>}
    </FieldGrid>
  )

  return (
    <div className="min-w-0">
      <div className="mb-4 flex justify-end">
        <div className="flex gap-2">
          <form action={refreshEquipmentLifecycle.bind(null, equipment.id)}>
            <Button variant="outline" size="sm" type="submit">
              Refresh Lifecycle
            </Button>
          </form>
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="mr-1 h-3 w-3" />
            Edit
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <section className="rounded-lg border bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Core identity</h3>
          {essentialFields}
        </section>

        {labelTools && (
          <MobileDisclosureSection title="Labels and QR" summary="Print equipment label or open public reporting code">
            {labelTools}
          </MobileDisclosureSection>
        )}

        {hierarchy && (
          <MobileDisclosureSection title="Asset hierarchy" summary="Parent and child asset relationships">
            {hierarchy}
          </MobileDisclosureSection>
        )}

        <MobileDisclosureSection title="Lifecycle and financials" summary="Risk score, value, replacement, service history">
          {lifecycleFields}
        </MobileDisclosureSection>
        <MobileDisclosureSection title="PM usage counters" summary="Run hours, cycles, PM trigger configuration">
          {usageFields}
        </MobileDisclosureSection>
        <MobileDisclosureSection title="Cybersecurity" summary="Network, patching, backup, and risk acceptance">
          {cyberFields}
        </MobileDisclosureSection>
        <MobileDisclosureSection title="Commissioning and notes" summary="Commissioning, decommissioning, and notes">
          {governanceFields}
        </MobileDisclosureSection>
      </div>
    </div>
  )
}
