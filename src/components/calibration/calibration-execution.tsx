"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { submitCalibrationBatch } from "@/lib/actions/calibration"
import { evaluateTolerance, getToleranceStatusDisplay } from "@/lib/utils/tolerance"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { ReasonForChange } from "@/components/shared/reason-for-change"
import { ReAuthDialog } from "@/components/shared/reauth-dialog"
import { AlertCircle, Gauge, Thermometer, Droplets } from "lucide-react"
import type { ReferenceStandard, CalibrationParameter } from "@/lib/types"

interface Props {
  equipmentId: string
  equipmentName: string
  equipmentTag: string
  calibrationParams?: CalibrationParameter[] | null
}

export function CalibrationExecution({
  equipmentId,
  equipmentName,
  equipmentTag,
  calibrationParams,
}: Props) {
  const [standards, setStandards] = useState<ReferenceStandard[]>([])
  const [selectedStandard, setSelectedStandard] = useState("")
  const [readings, setReadings] = useState<Record<string, string>>({})
  const [temperature, setTemperature] = useState("")
  const [humidity, setHumidity] = useState("")
  const [reason, setReason] = useState("")
  const [reasonError, setReasonError] = useState("")
  const [reauthOpen, setReauthOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const supabase = createClient()

  const params = calibrationParams || []

  useEffect(() => {
    supabase
      .from("reference_standards")
      .select("*")
      .eq("status", "active")
      .is("deleted_at", null)
      .order("name")
      .then(({ data }) => setStandards(data || []))
  }, [supabase])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedStandard) return
    if (!reason || reason.length < 5) {
      setReasonError("Reason for change is required (min 5 characters)")
      return
    }
    setReasonError("")
    setReauthOpen(true)
  }

  const doSubmit = async () => {
    setSubmitting(true)
    const formData = new FormData()
    formData.set("equipment_id", equipmentId)
    formData.set("reference_standard_id", selectedStandard)

    const readingsData = params.map((p) => ({
      parameter: p.parameter,
      measured_value: readings[p.parameter] || "0",
      expected_value: String(p.expected_value),
      tolerance_min: String(p.tolerance_min),
      tolerance_max: String(p.tolerance_max),
      unit: p.unit,
    }))
    formData.set("readings", JSON.stringify(readingsData))

    if (temperature) formData.set("temperature_celsius", temperature)
    if (humidity) formData.set("humidity_percent", humidity)
    formData.set("reason", reason)

    await submitCalibrationBatch(formData)
    setSubmitting(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gauge className="h-5 w-5 text-primary" />
          Calibration Execution
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {equipmentName} ({equipmentTag})
        </p>
      </CardHeader>
      <CardContent>
        {params.length === 0 ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-md border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
              <AlertCircle className="h-4 w-4" />
              No calibration parameters configured. Please configure parameters in the Calibration tab first.
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Environmental Conditions */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Thermometer className="h-3.5 w-3.5 text-muted-foreground" />
                  Temperature (°C)
                </Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="e.g., 22.5"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Droplets className="h-3.5 w-3.5 text-muted-foreground" />
                  Humidity (%)
                </Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="e.g., 45"
                  value={humidity}
                  onChange={(e) => setHumidity(e.target.value)}
                />
              </div>
            </div>

            {/* Reference Standard */}
            <div className="w-full">
              <Label>Reference Standard *</Label>
              <Select value={selectedStandard} onValueChange={setSelectedStandard}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a certified reference standard..." />
                </SelectTrigger>
                <SelectContent>
                  {standards.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.serial_number})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedStandard && (() => {
                const std = standards.find((s) => s.id === selectedStandard)
                if (!std) return null
                const isExpired = new Date(std.certificate_expiry) < new Date()
                return (
                  <p className={`mt-1 text-xs ${isExpired ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                    Cert: {std.certificate_number || "N/A"} — Expires: {std.certificate_expiry}
                    {isExpired && " (EXPIRED — cannot proceed)"}
                  </p>
                )
              })()}
            </div>

            {/* Calibration Readings */}
            <div>
              <Label className="mb-2 block">Calibration Readings</Label>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="pb-2 font-medium">Parameter</th>
                      <th className="pb-2 font-medium">Expected</th>
                      <th className="pb-2 font-medium">Tolerance</th>
                      <th className="pb-2 font-medium">Measured</th>
                      <th className="pb-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {params.map((param) => {
                      const measured = parseFloat(readings[param.parameter] || "")
                      const toleranceResult = !isNaN(measured)
                        ? evaluateTolerance(measured, param.expected_value, param.tolerance_min, param.tolerance_max)
                        : null
                      const display = toleranceResult ? getToleranceStatusDisplay(toleranceResult) : null

                      return (
                        <tr key={param.parameter} className="border-b">
                          <td className="py-2 font-medium">{param.parameter}</td>
                          <td className="py-2 font-mono text-xs">
                            {param.expected_value}{param.unit ? ` ${param.unit}` : ""}
                          </td>
                          <td className="py-2 font-mono text-xs">
                            {param.tolerance_min} – {param.tolerance_max}{param.unit ? ` ${param.unit}` : ""}
                          </td>
                          <td className="py-2">
                            <Input
                              className="h-8 w-28 text-xs"
                              type="number"
                              step="any"
                              placeholder={param.unit || ""}
                              value={readings[param.parameter] || ""}
                              onChange={(e) => setReadings({ ...readings, [param.parameter]: e.target.value })}
                            />
                          </td>
                          <td className="py-2">
                            {display && (
                              <Badge variant="outline" className={`text-xs ${display.color} ${display.bgColor}`}>
                                {display.label}
                              </Badge>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <ReasonForChange value={reason} onChange={(v) => { setReason(v); setReasonError("") }} error={reasonError} />

            <Button type="submit" disabled={submitting || !selectedStandard}>
              {submitting ? "Submitting..." : "Submit Calibration"}
            </Button>
          </form>
        )}
      </CardContent>

      <ReAuthDialog
        open={reauthOpen}
        onOpenChange={setReauthOpen}
        actionLabel={`Calibration — ${equipmentName}`}
        meaning="Calibrated"
        onSuccess={doSubmit}
        onCancel={() => setReauthOpen(false)}
      />
    </Card>
  )
}
