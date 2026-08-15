export type HealthState = "healthy" | "degraded" | "down"

export interface HealthCheck {
  status: HealthState
  message: string
  details?: Record<string, unknown>
}

export interface OperationalHealth {
  status: HealthState
  timestamp: string
  checks: {
    environment: HealthCheck
    database: HealthCheck
    pmEngine: HealthCheck
    notificationOutbox: HealthCheck
    integrations: HealthCheck
  }
}

export interface HealthSupabaseClient {
  from(table: string): {
    select(columns: string, options?: { count?: "exact"; head?: boolean }): unknown
  }
}

export type HealthEnvironment = Partial<Record<string, string | undefined>>

type QueryBuilder = {
  order?: (column: string, options?: { ascending?: boolean }) => QueryBuilder
  limit?: (count: number) => Promise<{ data?: unknown; error?: { message: string } | null; count?: number | null }> | QueryBuilder
  in?: (column: string, values: string[]) => QueryBuilder
  lt?: (column: string, value: number) => Promise<{ data?: unknown; error?: { message: string } | null; count?: number | null }> | QueryBuilder
  gte?: (column: string, value: string) => QueryBuilder
  eq?: (column: string, value: unknown) => QueryBuilder
  lte?: (column: string, value: string) => QueryBuilder
  not?: (column: string, operator: string, value: unknown) => QueryBuilder
}

const REQUIRED_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "CRON_SECRET",
]

function worstStatus(statuses: HealthState[]): HealthState {
  if (statuses.includes("down")) return "down"
  if (statuses.includes("degraded")) return "degraded"
  return "healthy"
}

export function checkEnvironment(env: HealthEnvironment = process.env): HealthCheck {
  const missing = REQUIRED_ENV.filter((key) => !env[key])
  return missing.length === 0
    ? { status: "healthy", message: "Required runtime configuration is present" }
    : { status: "degraded", message: "Missing runtime configuration", details: { missing } }
}

async function checkDatabase(supabase: HealthSupabaseClient): Promise<HealthCheck> {
  try {
    const result = await (supabase.from("equipment").select("id", { count: "exact", head: true }) as Promise<{
      error?: { message: string } | null
      count?: number | null
    }>)
    if (result.error) return { status: "down", message: result.error.message }
    return { status: "healthy", message: "Database query succeeded", details: { equipmentCount: result.count ?? null } }
  } catch (error) {
    return { status: "down", message: error instanceof Error ? error.message : "Database query failed" }
  }
}

async function checkPmEngine(supabase: HealthSupabaseClient, now = new Date()): Promise<HealthCheck> {
  const result = await ((supabase.from("pm_engine_runs").select("started_at, status, failures") as QueryBuilder)
    .order?.("started_at", { ascending: false })
    .limit?.(1) as Promise<{ data?: unknown; error?: { message: string } | null }>)

  if (result.error) return { status: "degraded", message: result.error.message }
  const latest = Array.isArray(result.data) ? result.data[0] as { started_at: string; status: string; failures: number } | undefined : undefined
  if (!latest) return { status: "degraded", message: "PM engine has no recorded runs" }

  const ageHours = (now.getTime() - new Date(latest.started_at).getTime()) / 3_600_000
  if (latest.status === "failed") return { status: "degraded", message: "Latest PM engine run failed", details: { latest } }
  if (ageHours > 48) return { status: "degraded", message: "Latest PM engine run is older than 48 hours", details: { latest, ageHours } }
  return { status: "healthy", message: "PM engine has recent run history", details: { latest, ageHours } }
}

async function checkNotificationOutbox(supabase: HealthSupabaseClient): Promise<HealthCheck> {
  const [requestResult, pmResult] = await Promise.all([
    ((supabase.from("request_notifications").select("id", { count: "exact", head: true }) as QueryBuilder)
      .in?.("delivery_status", ["pending", "failed"])
      .lt?.("delivery_attempts", 3) as Promise<{ error?: { message: string } | null; count?: number | null }>),
    ((supabase.from("pm_escalation_notifications").select("id", { count: "exact", head: true }) as QueryBuilder)
      .in?.("delivery_status", ["pending", "failed"])
      .lt?.("delivery_attempts", 3) as Promise<{ error?: { message: string } | null; count?: number | null }>),
  ])

  const error = requestResult.error || pmResult.error
  if (error) return { status: "degraded", message: error.message }

  const pending = (requestResult.count || 0) + (pmResult.count || 0)
  if (pending > 100) {
    return { status: "degraded", message: "Notification outbox backlog is high", details: { pending } }
  }
  return { status: "healthy", message: "Notification outbox backlog is acceptable", details: { pending } }
}

async function checkIntegrations(supabase: HealthSupabaseClient, now = new Date()): Promise<HealthCheck> {
  const soon = new Date(now)
  soon.setDate(soon.getDate() + 14)

  const keyQuery = supabase.from("api_keys").select("id", { count: "exact", head: true }) as QueryBuilder
  const eventQuery = supabase.from("api_key_usage_events").select("id", { count: "exact", head: true }) as QueryBuilder
  if (!keyQuery.eq || !keyQuery.not || !keyQuery.lte || !eventQuery.eq || !eventQuery.gte) {
    return { status: "degraded", message: "Integration health queries are not available" }
  }

  const [expiringKeys, rejectedEvents] = await Promise.all([
    keyQuery.eq("active", true).not!("expires_at", "is", null).lte!("expires_at", soon.toISOString()) as Promise<{ error?: { message: string } | null; count?: number | null }>,
    eventQuery.eq("outcome", "rejected").gte!("occurred_at", new Date(now.getTime() - 24 * 3_600_000).toISOString()) as Promise<{ error?: { message: string } | null; count?: number | null }>,
  ])

  const error = expiringKeys.error || rejectedEvents.error
  if (error) return { status: "degraded", message: error.message }

  const expiring = expiringKeys.count || 0
  const rejected = rejectedEvents.count || 0
  if (rejected > 25 || expiring > 0) {
    return { status: "degraded", message: "Integration attention is required", details: { expiringKeys: expiring, rejectedEvents24h: rejected } }
  }
  return { status: "healthy", message: "Integration keys and API usage are within limits", details: { expiringKeys: expiring, rejectedEvents24h: rejected } }
}

export async function getOperationalHealth(
  supabase: HealthSupabaseClient,
  env: HealthEnvironment = process.env,
  now = new Date(),
): Promise<OperationalHealth> {
  const checks = {
    environment: checkEnvironment(env),
    database: await checkDatabase(supabase),
    pmEngine: await checkPmEngine(supabase, now),
    notificationOutbox: await checkNotificationOutbox(supabase),
    integrations: await checkIntegrations(supabase, now),
  }

  return {
    status: worstStatus(Object.values(checks).map((check) => check.status)),
    timestamp: now.toISOString(),
    checks,
  }
}
