import { describe, it, expect } from "vitest"
import { evaluateTolerance, getToleranceStatusDisplay } from "@/lib/utils/tolerance"

describe("evaluateTolerance", () => {
  it("passes when measured value is within tolerance range", () => {
    const result = evaluateTolerance(100, 100, 95, 105)
    expect(result.passed).toBe(true)
    expect(result.deviation).toBe(0)
    expect(result.deviationPercent).toBe(0)
  })

  it("passes at the minimum tolerance boundary", () => {
    const result = evaluateTolerance(95, 100, 95, 105)
    expect(result.passed).toBe(true)
  })

  it("passes at the maximum tolerance boundary", () => {
    const result = evaluateTolerance(105, 100, 95, 105)
    expect(result.passed).toBe(true)
  })

  it("fails when measured value is below tolerance range", () => {
    const result = evaluateTolerance(90, 100, 95, 105)
    expect(result.passed).toBe(false)
    expect(result.deviation).toBe(-10)
  })

  it("fails when measured value is above tolerance range", () => {
    const result = evaluateTolerance(110, 100, 95, 105)
    expect(result.passed).toBe(false)
    expect(result.deviation).toBe(10)
  })

  it("calculates deviation percentage correctly", () => {
    const result = evaluateTolerance(105, 100, 95, 110)
    expect(result.deviationPercent).toBe(5)
  })

  it("handles negative tolerance ranges", () => {
    const result = evaluateTolerance(-40, -40, -45, -35)
    expect(result.passed).toBe(true)
    expect(result.deviation).toBe(0)
    expect(result.deviationPercent).toBe(0)
  })

  it("handles zero expected value", () => {
    const result = evaluateTolerance(0, 0, -1, 1)
    expect(result.passed).toBe(true)
    expect(result.deviationPercent).toBe(0)
  })
})

describe("getToleranceStatusDisplay", () => {
  it("returns out of tolerance for failed readings", () => {
    const result = evaluateTolerance(50, 100, 90, 110)
    const display = getToleranceStatusDisplay(result)
    expect(display.label).toBe("Out of Tolerance")
    expect(display.color).toBe("text-red-800")
  })

  it("returns marginal for readings with high deviation", () => {
    const result = evaluateTolerance(100, 50, 45, 110)
    const display = getToleranceStatusDisplay(result)
    expect(display.label).toBe("Marginal")
  })

  it("returns within tolerance for readings close to expected", () => {
    const result = evaluateTolerance(100, 100, 95, 105)
    const display = getToleranceStatusDisplay(result)
    expect(display.label).toBe("Within Tolerance")
    expect(display.color).toBe("text-green-800")
  })
})
