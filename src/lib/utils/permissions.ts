import type { PermissionGrant, Profile } from "@/lib/types"

export interface PermissionRequest {
  action: string
  resource: string
  scopeType?: PermissionGrant["scope_type"]
  scopeId?: string | null
}

export function roleAllowsPermission(role: Profile["role"], request: PermissionRequest) {
  if (role === "admin") return true
  if (request.action === "read") return true
  if (role === "viewer") return false

  if (request.resource === "equipment") return ["write", "lifecycle", "documents", "retire"].includes(request.action)
  if (request.resource === "work_orders") return ["write", "close"].includes(request.action)
  if (request.resource === "job_cards") return ["write", "complete"].includes(request.action)
  if (request.resource === "calibration") return ["write", "approve", "revoke"].includes(request.action)
  if (request.resource === "parts") return ["write", "consume", "restock"].includes(request.action)
  if (request.resource === "pm_schedules") return ["write", "run", "skip"].includes(request.action)
  if (request.resource === "requests") return ["triage", "approve", "convert", "reject"].includes(request.action)
  if (request.resource === "inventory") return ["write", "receive", "transfer", "count"].includes(request.action)
  if (request.resource === "purchasing") return request.action === "request"
  if (request.resource === "imports") return ["preview", "commit", "rollback"].includes(request.action)

  return false
}

export function permissionGrantMatches(grant: PermissionGrant, request: PermissionRequest) {
  const actionMatches = grant.action === request.action || grant.action === "*"
  const resourceMatches = grant.resource === request.resource || grant.resource === "*"
  if (!actionMatches || !resourceMatches) return false

  const requestedScopeType = request.scopeType || "global"
  if (grant.scope_type === "global") return true
  if (grant.scope_type !== requestedScopeType) return false
  return grant.scope_id === (request.scopeId || null)
}

export function resolvePermissionFromGrants(
  role: Profile["role"],
  request: PermissionRequest,
  grants: PermissionGrant[]
) {
  const matching = grants.filter((grant) => permissionGrantMatches(grant, request))
  matching.sort((a, b) => {
    const aSpecificity = (a.action === "*" ? 0 : 1) + (a.resource === "*" ? 0 : 1) + (a.scope_type === "global" ? 0 : 1)
    const bSpecificity = (b.action === "*" ? 0 : 1) + (b.resource === "*" ? 0 : 1) + (b.scope_type === "global" ? 0 : 1)
    return bSpecificity - aSpecificity
  })

  if (matching[0]) return matching[0].granted
  return roleAllowsPermission(role, request)
}

export function can(
  user: Pick<Profile, "role">,
  action: string,
  resource: string,
  scope?: Pick<PermissionRequest, "scopeType" | "scopeId">,
  grants: PermissionGrant[] = []
) {
  return resolvePermissionFromGrants(user.role, { action, resource, ...scope }, grants)
}
