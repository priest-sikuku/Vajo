import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { getClientIp, detectGeolocationFromIp } from "@/lib/geolocation"

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const guestAllowedRoutes = [
    "/",
    "/dashboard",
    "/p2p",
    "/assets",
    "/transactions",
    "/profile",
    "/auth",
    "/_next",
  ]

  const isGuestAllowed = guestAllowedRoutes.some((route) => request.nextUrl.pathname.startsWith(route))

  if (!user && !isGuestAllowed) {
    const url = request.nextUrl.clone()
    url.pathname = "/auth/sign-in"
    url.searchParams.set("next", request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  if (user) {
    try {
      const clientIp = getClientIp(request)
      const geolocation = await detectGeolocationFromIp(clientIp)

      if (geolocation && geolocation.country_code) {
        // Call RPC function to update user location in database
        await supabase.rpc('update_user_location_from_ip', {
          p_user_id: user.id,
          p_ip_address: clientIp,
          p_country_code: geolocation.country_code,
          p_country_name: geolocation.country_name,
          p_city: geolocation.city || null,
          p_latitude: geolocation.latitude || null,
          p_longitude: geolocation.longitude || null,
        })

        console.log('[v0] User geolocation updated:', {
          userId: user.id,
          ip: clientIp,
          country: geolocation.country_code,
        })
      }
    } catch (error) {
      console.error('[v0] Middleware geolocation error:', error)
      // Continue without error - geolocation is optional
    }
  }

  return supabaseResponse
}
