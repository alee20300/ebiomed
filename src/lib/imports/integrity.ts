import { createHash } from "crypto"

export function computeImportSourceHash(input: string) {
  return createHash("sha256").update(input).digest("hex")
}

export function validateImportCommitIntegrity(batch: {
  status: string
  error_rows: number
  total_rows: number
  valid_rows: number
  preview?: unknown[]
}) {
  if (batch.status !== "previewed") return { ok: false, error: "Only previewed batches can be committed" }
  if (batch.error_rows > 0) return { ok: false, error: "Fix validation errors before commit" }
  if (batch.valid_rows !== batch.total_rows) return { ok: false, error: "Valid row count must match total rows before commit" }
  if ((batch.preview || []).length !== batch.valid_rows) return { ok: false, error: "Preview row count does not match validated row count" }
  return { ok: true as const }
}
