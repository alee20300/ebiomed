"use client"

import { useState, useEffect } from "react"
import { getCalibrationReadings, updateEquipmentCalibrationParams } from "@/lib/actions/calibration"
import { evaluateTolerance, getToleranceStatusDisplay } from "@/lib/utils/tolerance"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ReasonForChange } from "@/components/shared/reason-for-change"
import { format } from "date-fns"
import { Plus } from "lucide-react"
import type { CalibrationReading, CalibrationParameter } from "@/lib/types"

interface Props {
  equipmentId: string
  calibrationIntervalDays?: number | null
  calibrationParams?: CalibrationParameter[] | null
}

export function EquipmentCalibrationTab({ equipmentId, calibrationIntervalDays, calibrationParams }: Props) {
  const [readings, setReadings] = useState<CalibrationReading[]>([])
  const [params, setParams] = useState<CalibrationParameter[]>(calibrationParams || [])
  const [intervalDays, setIntervalDays] = useState<number>(calibrationIntervalDays || 365)
  const [reason, setReason] = useState("")
  const [reasonError, setReasonError] = useState("")
  const [savingParams, setSavingParams] = useState(false)

  useEffect(() => {
    getCalibrationReadings(equipmentId).then((data) => setReadings(data))
  }, [equipmentId])

  const handleSaveParams = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason || reason.length < 5) {
      setReasonError("Reason for change is required (min 5 characters)")
      return
    }
    setSavingParams(true)
    const formData = new FormData()
    formData.set("calibration_interval_days", String(intervalDays))
    formData.set("calibration_parameters", JSON.stringify(params))
    formData.set("reason", reason)
    await updateEquipmentCalibrationParams(equipmentId, formData)
    setSavingParams(false)
  }

  const addParam = () => {
    setParams([...params, { parameter: "", unit: "", expected_value: 0, tolerance_min: 0, tolerance_max: 0 }])
  }

  const updateParam = (index: number, field: string, value: string | number) => {
    const updated = [...params]
    updated[index] = { ...updated[index], [field]: value }
    setParams(updated)
  }

  const removeParam = (index: number) => {
    setParams(params.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-6">
      {/* Calibration Readings History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Calibration Readings</CardTitle>
        </CardHeader>
        <CardContent>
          {readings.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No calibration readings recorded.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="pb-2 font-medium">Date</th>
                    <th className="pb-2 font-medium">Parameter</th>
                    <th className="pb-2 font-medium">Measured</th>
                    <th className="pb-2 font-medium">Expected</th>
                    <th className="pb-2 font-medium">Tolerance</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Ref Standard</th>
                    <th className="pb-2 font-medium">Tech</th>
                  </tr>
                </thead>
                <tbody>
                  {readings.map((r) => {
                    const result = evaluateTolerance(r.measured_value, r.expected_value, r.tolerance_min, r.tolerance_max)
                    const display = getToleranceStatusDisplay(result)
                    return (
                      <tr key={r.id} className="border-b">
                        <td className="py-2 text-xs">{format(new Date(r.recorded_at), "yyyy-MM-dd HH:mm")}</td>
                        <td className="py-2 font-medium">{r.parameter}</td>
                        <td className="py-2 font-mono text-xs">{r.measured_value}{r.unit ? ` ${r.unit}` : ""}</td>
                        <td className="py-2 font-mono text-xs">{r.expected_value}{r.unit ? ` ${r.unit}` : ""}</td>
                        <td className="py-2 font-mono text-xs">±{r.tolerance_max - r.expected_value}{r.unit ? ` ${r.unit}` : ""}</td>
                        <td className="py-2">
                          <Badge variant="outline" className={`text-xs ${display.color} ${display.bgColor}`}>
                            {display.label}
                          </Badge>
                        </td>
                        <td className="py-2 font-mono text-xs">{r.reference_standard?.serial_number || "—"}</td>
                        <td className="py-2 text-xs">{r.profile?.full_name || "—"}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Calibration Parameters Configuration */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Calibration Parameters</CardTitle>
          <Button variant="outline" size="sm" onClick={addParam}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add Parameter
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveParams} className="space-y-4">
            <div className="w-48">
              <Label htmlFor="calib-interval">Calibration Interval (days)</Label>
              <Input
                id="calib-interval"
                type="number"
                min="1"
                value={intervalDays}
                onChange={(e) => setIntervalDays(parseInt(e.target.value) || 365)}
              />
            </div>

            {params.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="pb-2 font-medium">Parameter</th>
                      <th className="pb-2 font-medium">Unit</th>
                      <th className="pb-2 font-medium">Expected</th>
                      <th className="pb-2 font-medium">Min</th>
                      <th className="pb-2 font-medium">Max</th>
                      <th className="pb-2 w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {params.map((param, i) => (
                      <tr key={i} className="border-b">
                        <td className="py-1 pr-2">
                          <Input
                            className="h-8 text-xs"
                            placeholder="Parameter"
                            value={param.parameter}
                            onChange={(e) => updateParam(i, "parameter", e.target.value)}
                          />
                        </td>
                        <td className="py-1 pr-2">
                          <Input
                            className="h-8 w-20 text-xs"
                            placeholder="Unit"
                            value={param.unit}
                            onChange={(e) => updateParam(i, "unit", e.target.value)}
                          />
                        </td>
                        <td className="py-1 pr-2">
                          <Input
                            className="h-8 w-20 text-xs"
                            type="number"
                            placeholder="Expected"
                            value={param.expected_value || ""}
                            onChange={(e) => updateParam(i, "expected_value", parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td className="py-1 pr-2">
                          <Input
                            className="h-8 w-20 text-xs"
                            type="number"
                            placeholder="Min"
                            value={param.tolerance_min || ""}
                            onChange={(e) => updateParam(i, "tolerance_min", parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td className="py-1 pr-2">
                          <Input
                            className="h-8 w-20 text-xs"
                            type="number"
                            placeholder="Max"
                            value={param.tolerance_max || ""}
                            onChange={(e) => updateParam(i, "tolerance_max", parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td className="py-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" type="button" onClick={() => removeParam(i)}>
                            ×
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <ReasonForChange value={reason} onChange={(v) => { setReason(v); setReasonError("") }} error={reasonError} />
            <Button type="submit" disabled={savingParams}>
              {savingParams ? "Saving..." : "Save Parameters"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
