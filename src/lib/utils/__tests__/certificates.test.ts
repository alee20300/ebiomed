import { describe, expect, it } from "vitest"
import {
  buildCertificateNumber,
  calculateCertificateValidUntil,
  computeAuditTrailHash,
} from "@/lib/utils/certificates"

describe("certificate helpers", () => {
  it("builds deterministic certificate numbers", () => {
    expect(buildCertificateNumber(2026, 0)).toBe("CERT-2026-0001")
    expect(buildCertificateNumber(2026, 42)).toBe("CERT-2026-0043")
  })

  it("computes stable audit trail hashes", () => {
    const payload = { equipment_id: "asset-1", readings: [{ parameter: "Temp", passed: true }] }
    expect(computeAuditTrailHash(payload)).toBe(computeAuditTrailHash(payload))
    expect(computeAuditTrailHash(payload)).toHaveLength(64)
  })

  it("calculates certificate expiry from issue date and interval", () => {
    const issuedAt = new Date("2026-06-05T00:00:00.000Z")
    expect(calculateCertificateValidUntil(issuedAt, 365).toISOString()).toBe("2027-06-05T00:00:00.000Z")
  })
})
