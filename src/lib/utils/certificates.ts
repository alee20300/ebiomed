import { createHash } from "crypto"

export function buildCertificateNumber(year: number, existingCount: number): string {
  return `CERT-${year}-${String(existingCount + 1).padStart(4, "0")}`
}

export function computeAuditTrailHash(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex")
}

export function calculateCertificateValidUntil(issuedAt: Date, intervalDays: number): Date {
  const validUntil = new Date(issuedAt)
  validUntil.setDate(validUntil.getDate() + intervalDays)
  return validUntil
}
