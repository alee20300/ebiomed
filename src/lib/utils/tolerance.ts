export interface ToleranceResult {
  passed: boolean
  deviation: number
  deviationPercent: number
}

export function evaluateTolerance(
  measured: number,
  expected: number,
  min: number,
  max: number
): ToleranceResult {
  const passed = measured >= min && measured <= max
  const deviation = measured - expected
  const deviationPercent = expected !== 0 ? (deviation / Math.abs(expected)) * 100 : 0

  return { passed, deviation, deviationPercent: Math.round(deviationPercent * 100) / 100 }
}

export function getToleranceStatusDisplay(result: ToleranceResult): {
  label: string
  color: string
  bgColor: string
} {
  if (!result.passed) {
    return {
      label: "Out of Tolerance",
      color: "text-red-800",
      bgColor: "bg-red-100",
    }
  }

  const absDeviation = Math.abs(result.deviationPercent)
  if (absDeviation > 50) {
    return {
      label: "Marginal",
      color: "text-yellow-800",
      bgColor: "bg-yellow-100",
    }
  }

  return {
    label: "Within Tolerance",
    color: "text-green-800",
    bgColor: "bg-green-100",
  }
}
