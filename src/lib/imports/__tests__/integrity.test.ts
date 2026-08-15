import { describe, expect, it } from "vitest"
import { computeImportSourceHash, validateImportCommitIntegrity } from "@/lib/imports/integrity"

describe("import integrity", () => {
  it("computes deterministic source hashes", () => {
    expect(computeImportSourceHash("a,b\n1,2")).toMatch(/^[a-f0-9]{64}$/)
    expect(computeImportSourceHash("a,b\n1,2")).toBe(computeImportSourceHash("a,b\n1,2"))
  })

  it("blocks commits when preview counts drift", () => {
    expect(validateImportCommitIntegrity({
      status: "previewed",
      error_rows: 0,
      total_rows: 2,
      valid_rows: 2,
      preview: [{}, {}],
    }).ok).toBe(true)

    expect(validateImportCommitIntegrity({
      status: "previewed",
      error_rows: 0,
      total_rows: 2,
      valid_rows: 2,
      preview: [{}],
    }).ok).toBe(false)
  })
})
