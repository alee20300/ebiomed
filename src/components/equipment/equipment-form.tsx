"use client"

import { useSearchParams } from "next/navigation"
import { createEquipment, updateEquipment } from "@/lib/actions/equipment"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import type { Equipment } from "@/lib/types"

interface Props {
  equipment?: Equipment
  onCancel?: () => void
  hideCancel?: boolean
}

export function EquipmentForm({ equipment, onCancel, hideCancel }: Props) {
  const searchParams = useSearchParams()
  const error = searchParams.get("error")

  return (
    <form action={equipment ? updateEquipment.bind(null, equipment.id) : createEquipment} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="tag_number">Tag Number *</Label>
          <Input
            id="tag_number"
            name="tag_number"
            defaultValue={equipment?.tag_number}
            required
          />
        </div>
        <div>
          <Label htmlFor="name">Equipment Name *</Label>
          <Input
            id="name"
            name="name"
            defaultValue={equipment?.name}
            required
          />
        </div>
        <div>
          <Label htmlFor="serial_number">Serial Number</Label>
          <Input
            id="serial_number"
            name="serial_number"
            defaultValue={equipment?.serial_number || ""}
          />
        </div>
        <div>
          <Label htmlFor="model">Model</Label>
          <Input
            id="model"
            name="model"
            defaultValue={equipment?.model || ""}
          />
        </div>
        <div>
          <Label htmlFor="manufacturer">Manufacturer</Label>
          <Input
            id="manufacturer"
            name="manufacturer"
            defaultValue={equipment?.manufacturer || ""}
          />
        </div>
        <div>
          <Label htmlFor="category">Category</Label>
          <Input
            id="category"
            name="category"
            defaultValue={equipment?.category || ""}
          />
        </div>
        <div>
          <Label htmlFor="device_category">Device Category</Label>
          <Input
            id="device_category"
            name="device_category"
            defaultValue={equipment?.device_category || ""}
            placeholder="e.g. Life support, imaging, monitoring"
          />
        </div>
        <div>
          <Label htmlFor="department">Department</Label>
          <Input
            id="department"
            name="department"
            defaultValue={equipment?.department || ""}
          />
        </div>
        <div>
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            name="location"
            defaultValue={equipment?.location || ""}
          />
        </div>
        <div>
          <Label htmlFor="status">Status</Label>
          <Select name="status" defaultValue={equipment?.status || "active"}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="retired">Retired</SelectItem>
              <SelectItem value="under_repair">Under Repair</SelectItem>
              <SelectItem value="out_of_tolerance">Out of Tolerance</SelectItem>
              <SelectItem value="certified">Certified</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="install_date">Install Date</Label>
          <Input
            id="install_date"
            name="install_date"
            type="date"
            defaultValue={equipment?.install_date || ""}
          />
        </div>
        <div>
          <Label htmlFor="warranty_expiry">Warranty Expiry</Label>
          <Input
            id="warranty_expiry"
            name="warranty_expiry"
            type="date"
            defaultValue={equipment?.warranty_expiry || ""}
          />
        </div>
      </div>

      <div className="border-t pt-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Biomedical Classification</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="asset_criticality">Asset Criticality</Label>
            <Select name="asset_criticality" defaultValue={equipment?.asset_criticality || "medium"}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="life_support">Life Support</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="risk_class">Regulatory Risk Class</Label>
            <Select name="risk_class" defaultValue={equipment?.risk_class || "class_ii"}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="class_i">Class I</SelectItem>
                <SelectItem value="class_ii">Class II</SelectItem>
                <SelectItem value="class_iii">Class III</SelectItem>
                <SelectItem value="not_applicable">Not Applicable</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="ownership_type">Ownership Type</Label>
            <Select name="ownership_type" defaultValue={equipment?.ownership_type || "owned"}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="owned">Owned</SelectItem>
                <SelectItem value="leased">Leased</SelectItem>
                <SelectItem value="rental">Rental</SelectItem>
                <SelectItem value="loaner">Loaner</SelectItem>
                <SelectItem value="demo">Demo</SelectItem>
                <SelectItem value="vendor_owned">Vendor Owned</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="cost_center">Cost Center</Label>
            <Input id="cost_center" name="cost_center" defaultValue={equipment?.cost_center || ""} />
          </div>
          <div>
            <Label htmlFor="clinical_area">Clinical Area</Label>
            <Input id="clinical_area" name="clinical_area" defaultValue={equipment?.clinical_area || ""} />
          </div>
          <div>
            <Label htmlFor="manufacturer_device_id">Manufacturer Device ID</Label>
            <Input id="manufacturer_device_id" name="manufacturer_device_id" defaultValue={equipment?.manufacturer_device_id || ""} />
          </div>
        </div>
      </div>

      <div className="border-t pt-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Lifecycle & Valuation</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="acquisition_date">Acquisition Date</Label>
            <Input id="acquisition_date" name="acquisition_date" type="date" defaultValue={equipment?.acquisition_date || ""} />
          </div>
          <div>
            <Label htmlFor="purchase_cost">Purchase Cost</Label>
            <Input id="purchase_cost" name="purchase_cost" type="number" min="0" step="0.01" defaultValue={equipment?.purchase_cost ?? ""} />
          </div>
          <div>
            <Label htmlFor="expected_life_years">Expected Life (years)</Label>
            <Input id="expected_life_years" name="expected_life_years" type="number" min="0.1" step="0.1" defaultValue={equipment?.expected_life_years ?? ""} />
          </div>
          <div>
            <Label htmlFor="residual_value">Residual Value</Label>
            <Input id="residual_value" name="residual_value" type="number" min="0" step="0.01" defaultValue={equipment?.residual_value ?? ""} />
          </div>
          <div>
            <Label htmlFor="current_value">Current Value Override</Label>
            <Input id="current_value" name="current_value" type="number" min="0" step="0.01" defaultValue={equipment?.current_value ?? ""} />
          </div>
          <div>
            <Label htmlFor="depreciation_method">Depreciation Method</Label>
            <Select name="depreciation_method" defaultValue={equipment?.depreciation_method || "straight_line"}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="straight_line">Straight Line</SelectItem>
                <SelectItem value="declining_balance">Declining Balance</SelectItem>
                <SelectItem value="none">None</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="replacement_target_date">Replacement Target Date</Label>
            <Input id="replacement_target_date" name="replacement_target_date" type="date" defaultValue={equipment?.replacement_target_date || ""} />
          </div>
          <div>
            <Label htmlFor="replacement_due_date">Replacement Due Date</Label>
            <Input id="replacement_due_date" name="replacement_due_date" type="date" defaultValue={equipment?.replacement_due_date || ""} />
          </div>
          <div>
            <Label htmlFor="support_expiry">Support Expiry</Label>
            <Input id="support_expiry" name="support_expiry" type="date" defaultValue={equipment?.support_expiry || ""} />
          </div>
          <div>
            <Label htmlFor="acceptance_test_date">Acceptance Test Date</Label>
            <Input id="acceptance_test_date" name="acceptance_test_date" type="date" defaultValue={equipment?.acceptance_test_date || ""} />
          </div>
          <div>
            <Label htmlFor="commissioned_at">Commissioned Date</Label>
            <Input id="commissioned_at" name="commissioned_at" type="date" defaultValue={equipment?.commissioned_at || ""} />
          </div>
          <div>
            <Label htmlFor="lifecycle_stage">Lifecycle Stage</Label>
            <Select name="lifecycle_stage" defaultValue={equipment?.lifecycle_stage || "commissioning"}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="planning">Planning</SelectItem>
                <SelectItem value="procurement">Procurement</SelectItem>
                <SelectItem value="commissioning">Commissioning</SelectItem>
                <SelectItem value="in_service">In Service</SelectItem>
                <SelectItem value="limited_support">Limited Support</SelectItem>
                <SelectItem value="end_of_life">End of Life</SelectItem>
                <SelectItem value="retired">Retired</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="retirement_reason">Retirement Reason</Label>
            <Input
              id="retirement_reason"
              name="retirement_reason"
              defaultValue={equipment?.retirement_reason || ""}
              placeholder="Required when lifecycle stage is retired"
            />
          </div>
        </div>
      </div>

      <div className="border-t pt-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Connected Device Profile</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="software_version">Software Version</Label>
            <Input id="software_version" name="software_version" defaultValue={equipment?.software_version || ""} />
          </div>
          <div>
            <Label htmlFor="firmware_version">Firmware Version</Label>
            <Input id="firmware_version" name="firmware_version" defaultValue={equipment?.firmware_version || ""} />
          </div>
          <div>
            <Label htmlFor="os_platform">OS / Platform</Label>
            <Input id="os_platform" name="os_platform" defaultValue={equipment?.os_platform || ""} />
          </div>
          <div>
            <Label htmlFor="network_zone">Network Zone</Label>
            <Input id="network_zone" name="network_zone" defaultValue={equipment?.network_zone || ""} />
          </div>
          <div>
            <Label htmlFor="network_connected">Network Connected</Label>
            <Select name="network_connected" defaultValue={equipment?.network_connected ? "true" : "false"}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="false">No</SelectItem>
                <SelectItem value="true">Yes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="ip_address">IP Address</Label>
            <Input id="ip_address" name="ip_address" defaultValue={equipment?.ip_address || ""} placeholder="192.168.1.25" />
          </div>
          <div>
            <Label htmlFor="mac_address">MAC Address</Label>
            <Input id="mac_address" name="mac_address" defaultValue={equipment?.mac_address || ""} placeholder="AA:BB:CC:DD:EE:FF" />
          </div>
          <div>
            <Label htmlFor="internet_exposed">Internet Exposed</Label>
            <Select name="internet_exposed" defaultValue={equipment?.internet_exposed ? "true" : "false"}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="false">No</SelectItem>
                <SelectItem value="true">Yes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="remote_access_enabled">Remote Access</Label>
            <Select name="remote_access_enabled" defaultValue={equipment?.remote_access_enabled ? "true" : "false"}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="false">Disabled</SelectItem>
                <SelectItem value="true">Enabled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="border-t pt-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Risk & Criticality</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["patient_impact", "Patient Impact", equipment?.patient_impact],
            ["downtime_impact", "Downtime Impact", equipment?.downtime_impact],
            ["utilization", "Utilization", equipment?.utilization],
            ["regulatory_class", "Regulatory Class", equipment?.regulatory_class],
            ["maintenance_burden", "Maintenance Burden", equipment?.maintenance_burden],
          ].map(([name, label, value]) => (
            <div key={name}>
              <Label htmlFor={name as string}>{label}</Label>
              <Select name={name as string} defaultValue={String(value ?? 3)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 - Low</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3 - Medium</SelectItem>
                  <SelectItem value="4">4</SelectItem>
                  <SelectItem value="5">5 - High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t pt-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Usage-Based PM</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="run_hours">Run Hours</Label>
            <Input
              id="run_hours"
              name="run_hours"
              type="number"
              min="0"
              step="0.1"
              defaultValue={equipment?.run_hours ?? 0}
            />
          </div>
          <div>
            <Label htmlFor="cycle_count">Cycle Count</Label>
            <Input
              id="cycle_count"
              name="cycle_count"
              type="number"
              min="0"
              step="1"
              defaultValue={equipment?.cycle_count ?? 0}
            />
          </div>
          <div>
            <Label htmlFor="pm_trigger_type">PM Trigger Type</Label>
            <Select name="pm_trigger_type" defaultValue={equipment?.pm_trigger_type || "calendar"}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="calendar">Calendar Only</SelectItem>
                <SelectItem value="run_hours">Run Hours</SelectItem>
                <SelectItem value="cycles">Cycles</SelectItem>
                <SelectItem value="calendar_or_usage">Calendar or Usage</SelectItem>
                <SelectItem value="calendar_and_usage">Calendar and Usage</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="pm_trigger_value">Usage Trigger Threshold</Label>
            <Input
              id="pm_trigger_value"
              name="pm_trigger_value"
              type="number"
              min="0.1"
              step="0.1"
              defaultValue={equipment?.pm_trigger_value ?? ""}
              placeholder="e.g. 500"
            />
          </div>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Calendar-only assets do not need a usage threshold. Usage-based triggers generate PM work orders when counters reach the threshold.
        </p>
      </div>

      <div className="border-t pt-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Asset Hierarchy</p>
        <div>
          <Label htmlFor="parent_id">Parent Asset ID</Label>
          <Input
            id="parent_id"
            name="parent_id"
            placeholder="UUID of parent asset (optional)"
            defaultValue={equipment?.parent_id || ""}
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Child assets inherit department and location from parent. Leave empty for top-level assets.
          </p>
        </div>
      </div>

      <div className="border-t pt-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Nomenclature (GMDN / UDI)</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="gmdn_code">GMDN Code</Label>
            <Input id="gmdn_code" name="gmdn_code" defaultValue={equipment?.gmdn_code || ""} />
          </div>
          <div>
            <Label htmlFor="gmdn_term">GMDN Term</Label>
            <Input id="gmdn_term" name="gmdn_term" defaultValue={equipment?.gmdn_term || ""} />
          </div>
          <div>
            <Label htmlFor="udi_di">UDI-DI (Device Identifier)</Label>
            <Input id="udi_di" name="udi_di" defaultValue={equipment?.udi_di || ""} />
          </div>
          <div>
            <Label htmlFor="udi_pi">UDI-PI (Production Identifier)</Label>
            <Input id="udi_pi" name="udi_pi" defaultValue={equipment?.udi_pi || ""} />
          </div>
        </div>
      </div>

      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={equipment?.notes || ""}
        />
      </div>

      <div className="border-t pt-4">
        <Label htmlFor="reason" className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <AlertCircle className="h-3.5 w-3.5" />
          Reason for Change (required for compliance)
        </Label>
        <Textarea
          id="reason"
          name="reason"
          placeholder="e.g., Added equipment to asset registry per department request..."
          className="mt-1.5 min-h-[60px] resize-none text-sm"
          rows={2}
        />
        <p className="mt-1 text-[11px] text-muted-foreground">
          Required per FDA 21 CFR Part 11. Every change must include a documented reason.
        </p>
      </div>

      {equipment && (
        <div>
          <Label htmlFor="reauth_password">Re-auth Password</Label>
          <Input
            id="reauth_password"
            name="reauth_password"
            type="password"
            autoComplete="current-password"
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Required when retiring an asset.
          </p>
        </div>
      )}

      <div className="flex gap-3">
        <Button type="submit">
          {equipment ? "Update Equipment" : "Create Equipment"}
        </Button>
        {!hideCancel && (
          <Button variant="outline" type="button" onClick={() => onCancel?.() || history.back()}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  )
}
