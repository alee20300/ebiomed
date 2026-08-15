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
      color: "text-danger-strong",
      bgColor: "bg-danger-subtle",
    }
  }

  const absDeviation = Math.abs(result.deviationPercent)
  if (absDeviation > 50) {
    return {
      label: "Marginal",
      color: "text-warning-strong",
      bgColor: "bg-warning-subtle",
    }
  }

  return {
    label: "Within Tolerance",
    color: "text-success-strong",
    bgColor: "bg-success-subtle",
  }
}
