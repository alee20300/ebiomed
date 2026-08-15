import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

function redirectWithSession(destination: URL, sessionResponse: NextResponse) {
  const redirectResponse = NextResponse.redirect(destination)

  sessionResponse.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie)
  })
  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = sessionResponse.headers.get(header)
    if (value) redirectResponse.headers.set(header, value)
  }

  return redirectResponse
}

function safeNextPath(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/dashboard"
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headersToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
          Object.entries(headersToSet).forEach(([key, value]) =>
            supabaseResponse.headers.set(key, value)
          )
        },
      },
    }
  )

  const url = request.nextUrl
  const isAuthRoute = url.pathname.startsWith("/login") || url.pathname.startsWith("/auth")
  const isPublicRoute =
    url.pathname.startsWith("/checklist") ||
    url.pathname.startsWith("/api/cron") ||
    url.pathname === "/api/health"
  const isPublicFile = url.pathname.startsWith("/_next") || url.pathname.includes(".")

  if (isPublicFile) {
    return supabaseResponse
  }

  // 0.0.0.0 is valid only as a server bind address. Safari blocks it as a
  // navigation target, so move browser requests to the configured LAN origin.
  const requestedHost = request.headers.get("host")?.split(":")[0]
  if (requestedHost === "0.0.0.0") {
    const canonicalUrl = new URL(`${url.pathname}${url.search}`, siteUrl)
    return redirectWithSession(canonicalUrl, supabaseResponse)
  }

  if (isPublicRoute) {
    return supabaseResponse
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user && !isAuthRoute) {
    const loginUrl = new URL("/login", siteUrl)
    loginUrl.searchParams.set("next", `${url.pathname}${url.search}`)
    return redirectWithSession(loginUrl, supabaseResponse)
  }

  if (user && isAuthRoute && url.pathname !== "/auth/callback") {
    const next = safeNextPath(url.searchParams.get("next"))
    return redirectWithSession(new URL(next, siteUrl), supabaseResponse)
  }

  return supabaseResponse
}
