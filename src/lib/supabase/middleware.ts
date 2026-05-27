import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const url = request.nextUrl
  const isAuthRoute = url.pathname.startsWith("/login") || url.pathname.startsWith("/auth")
  const isPublicRoute = url.pathname.startsWith("/report") || url.pathname.startsWith("/checklist") || url.pathname === "/api/health"
  const isPublicFile = url.pathname.startsWith("/_next") || url.pathname.includes(".")

  if (isPublicFile) {
    return supabaseResponse
  }

  if (isPublicRoute) {
    return supabaseResponse
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user && !isAuthRoute) {
    const loginUrl = new URL("/login", request.url)
    return NextResponse.redirect(loginUrl)
  }

  if (user && isAuthRoute && url.pathname !== "/auth/callback") {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  return supabaseResponse
}
