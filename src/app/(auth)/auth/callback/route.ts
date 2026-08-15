import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

type PendingCookie = {
  name: string
  value: string
  options: CookieOptions
}

function redirectWithSession(
  destination: string,
  pendingCookies: PendingCookie[],
  authHeaders: Headers
) {
  const response = NextResponse.redirect(destination)

  pendingCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options)
  })
  authHeaders.forEach((value, key) => {
    response.headers.set(key, value)
  })

  return response
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? origin
  const code = searchParams.get("code")
  const requestedNext = searchParams.get("next")
  const next = requestedNext?.startsWith("/") && !requestedNext.startsWith("//")
    ? requestedNext
    : "/dashboard"

  if (code) {
    const cookieStore = await cookies()
    const pendingCookies: PendingCookie[] = []
    const authHeaders = new Headers()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        db: { schema: "ebiomed" },
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet, headersToSet) {
            pendingCookies.push(...cookiesToSet)
            Object.entries(headersToSet).forEach(([key, value]) => {
              authHeaders.set(key, value)
            })
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return redirectWithSession(`${siteUrl}${next}`, pendingCookies, authHeaders)
    }
  }

  return NextResponse.redirect(`${siteUrl}/login?error=auth_callback_error`)
}
