import { describe, expect, it } from "vitest"
import { checkEnvironment, getOperationalHealth, type HealthSupabaseClient } from "@/lib/operations/health"

function mockSupabase(options: {
  equipmentError?: string
  pmRuns?: Array<{ started_at: string; status: string; failures: number }>
  requestPending?: number
  pmPending?: number
  expiringApiKeys?: number
  rejectedApiEvents?: number
}): HealthSupabaseClient {
  return {
    from(table: string) {
      return {
        select() {
          if (table === "equipment") {
            return Promise.resolve({ error: options.equipmentError ? { message: options.equipmentError } : null, count: 12 })
          }
          if (table === "pm_engine_runs") {
            return {
              order() { return this },
              limit() { return Promise.resolve({ data: options.pmRuns || [], error: null }) },
            }
          }
          return {
            eq() { return this },
            not() { return this },
            lte() {
              return Promise.resolve({ count: options.expiringApiKeys || 0, error: null })
            },
            gte() {
              return Promise.resolve({ count: options.rejectedApiEvents || 0, error: null })
            },
            in() { return this },
            lt() {
              const count = table === "request_notifications" ? options.requestPending || 0 : options.pmPending || 0
              return Promise.resolve({ count, error: null })
            },
          }
        },
      }
    },
  }
}

describe("operational health", () => {
  it("reports missing runtime configuration as degraded", () => {
    expect(checkEnvironment({ NEXT_PUBLIC_SUPABASE_URL: "http://localhost" })).toMatchObject({
      status: "degraded",
    })
  })

  it("reports healthy when config, database, jobs, and outbox are healthy", async () => {
    const health = await getOperationalHealth(
      mockSupabase({ pmRuns: [{ started_at: "2026-08-13T00:00:00.000Z", status: "success", failures: 0 }] }),
      {
        NEXT_PUBLIC_SUPABASE_URL: "http://localhost",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
        SUPABASE_SERVICE_ROLE_KEY: "service",
        CRON_SECRET: "secret",
      },
      new Date("2026-08-13T12:00:00.000Z"),
    )

    expect(health.status).toBe("healthy")
    expect(health.checks.database.status).toBe("healthy")
  })

  it("reports down when the database check fails", async () => {
    const health = await getOperationalHealth(
      mockSupabase({ equipmentError: "connection refused" }),
      {
        NEXT_PUBLIC_SUPABASE_URL: "http://localhost",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
        SUPABASE_SERVICE_ROLE_KEY: "service",
        CRON_SECRET: "secret",
      },
      new Date("2026-08-13T12:00:00.000Z"),
    )

    expect(health.status).toBe("down")
    expect(health.checks.database.message).toBe("connection refused")
  })

  it("reports degraded when PM run history is stale or notification backlog is high", async () => {
    const health = await getOperationalHealth(
      mockSupabase({
        pmRuns: [{ started_at: "2026-08-10T00:00:00.000Z", status: "success", failures: 0 }],
        requestPending: 75,
        pmPending: 50,
      }),
      {
        NEXT_PUBLIC_SUPABASE_URL: "http://localhost",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
        SUPABASE_SERVICE_ROLE_KEY: "service",
        CRON_SECRET: "secret",
      },
      new Date("2026-08-13T12:00:00.000Z"),
    )

    expect(health.status).toBe("degraded")
    expect(health.checks.pmEngine.status).toBe("degraded")
    expect(health.checks.notificationOutbox.status).toBe("degraded")
  })

  it("reports degraded when integration keys or usage events need attention", async () => {
    const health = await getOperationalHealth(
      mockSupabase({
        pmRuns: [{ started_at: "2026-08-13T00:00:00.000Z", status: "success", failures: 0 }],
        expiringApiKeys: 1,
      }),
      {
        NEXT_PUBLIC_SUPABASE_URL: "http://localhost",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
        SUPABASE_SERVICE_ROLE_KEY: "service",
        CRON_SECRET: "secret",
      },
      new Date("2026-08-13T12:00:00.000Z"),
    )

    expect(health.status).toBe("degraded")
    expect(health.checks.integrations.status).toBe("degraded")
  })
})
