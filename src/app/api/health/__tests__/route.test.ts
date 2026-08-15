import { describe, it, expect } from "vitest"
import { checkEnvironment } from "@/lib/operations/health"

describe("GET /api/health", () => {
  it("checks required environment variables", () => {
    const result = checkEnvironment({
      NEXT_PUBLIC_SUPABASE_URL: "http://localhost",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
      SUPABASE_SERVICE_ROLE_KEY: "service",
      CRON_SECRET: "secret",
    })

    expect(result.status).toBe("healthy")
  })
})
