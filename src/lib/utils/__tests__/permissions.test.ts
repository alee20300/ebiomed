import { describe, expect, it } from "vitest"
import {
  can,
  permissionGrantMatches,
  resolvePermissionFromGrants,
  roleAllowsPermission,
} from "@/lib/utils/permissions"
import type { PermissionGrant } from "@/lib/types"

const baseGrant = {
  id: "grant-1",
  profile_id: "user-1",
  action: "write",
  resource: "inventory",
  scope_type: "global",
  scope_id: null,
  granted: true,
  reason: "Approved",
  created_by: "admin-1",
  created_at: "2026-06-06T00:00:00.000Z",
  updated_at: "2026-06-06T00:00:00.000Z",
} satisfies PermissionGrant

describe("permission resolution", () => {
  it("uses role defaults when no grant matches", () => {
    expect(roleAllowsPermission("viewer", { action: "write", resource: "inventory" })).toBe(false)
    expect(roleAllowsPermission("technician", { action: "write", resource: "inventory" })).toBe(true)
    expect(roleAllowsPermission("technician", { action: "retire", resource: "equipment" })).toBe(true)
    expect(roleAllowsPermission("technician", { action: "triage", resource: "requests" })).toBe(true)
    expect(roleAllowsPermission("technician", { action: "write", resource: "settings" })).toBe(false)
    expect(roleAllowsPermission("admin", { action: "delete", resource: "settings" })).toBe(true)
  })

  it("matches explicit global and scoped grants", () => {
    expect(permissionGrantMatches(baseGrant, { action: "write", resource: "inventory" })).toBe(true)
    expect(permissionGrantMatches({
      ...baseGrant,
      scope_type: "site",
      scope_id: "site-1",
    }, { action: "write", resource: "inventory", scopeType: "site", scopeId: "site-1" })).toBe(true)
  })

  it("lets explicit grants override defaults", () => {
    expect(resolvePermissionFromGrants("technician", { action: "write", resource: "inventory" }, [
      { ...baseGrant, granted: false },
    ])).toBe(false)
    expect(resolvePermissionFromGrants("viewer", { action: "write", resource: "inventory" }, [
      baseGrant,
    ])).toBe(true)
  })

  it("exposes a central can helper", () => {
    expect(can({ role: "viewer" }, "write", "inventory", undefined, [baseGrant])).toBe(true)
    expect(can({ role: "viewer" }, "write", "inventory")).toBe(false)
  })
})
