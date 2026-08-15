import { describe, expect, it } from "vitest"
import { extractApiKey, hasApiScope } from "@/lib/api/auth"

describe("api auth scope checks", () => {
  it("extracts bearer and query api keys", () => {
    expect(extractApiKey(new Request("https://example.test", {
      headers: { authorization: "Bearer secret-key" },
    }))).toBe("secret-key")

    expect(extractApiKey(new Request("https://example.test?api_key=query-key"))).toBe("query-key")
  })

  it("allows exact action and resource scopes", () => {
    expect(hasApiScope({
      valid: true,
      scopes: ["write:telemetry"],
      resources: ["telemetry"],
    }, "write", "telemetry")).toBe(true)
  })

  it("allows wildcard scopes and resources", () => {
    expect(hasApiScope({
      valid: true,
      scopes: ["read:*"],
      resources: ["*"],
    }, "read", "equipment")).toBe(true)

    expect(hasApiScope({
      valid: true,
      scopes: ["*"],
      resources: ["reports"],
    }, "write", "reports")).toBe(true)
  })

  it("rejects missing action or resource permissions", () => {
    expect(hasApiScope({
      valid: true,
      scopes: ["read:equipment"],
      resources: ["equipment"],
    }, "write", "equipment")).toBe(false)

    expect(hasApiScope({
      valid: true,
      scopes: ["write:*"],
      resources: ["inventory"],
    }, "write", "telemetry")).toBe(false)
  })

  it("rejects invalid keys even when scopes match", () => {
    expect(hasApiScope({
      valid: false,
      scopes: ["*"],
      resources: ["*"],
    }, "read", "equipment")).toBe(false)
  })
})
