import { NextRequest, NextResponse } from "next/server"
import { getClientIp, detectGeolocationFromIp, isAfricanCountry } from "@/lib/geolocation"
import { createServerClient } from "@supabase/ssr"

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const geolocation = await detectGeolocationFromIp(ip);

    if (!geolocation) {
      return NextResponse.json({
        success: false,
        ip,
        country_code: 'KE', // Default fallback country code
        country_name: 'Kenya', // Default fallback country name
        is_african: true, // Default fallback is African
        detected: false, // Flag to indicate this is a default fallback
      });
    }

    const isAfrican = isAfricanCountry(geolocation.country_code);

    return NextResponse.json({
      success: true,
      ip,
      country_code: isAfrican ? geolocation.country_code : 'KE', // Keep KE if not African for consistency
      country_name: geolocation.country_name,
      city: geolocation.city,
      latitude: geolocation.latitude,
      longitude: geolocation.longitude,
      is_african: isAfrican,
      detected: true,
    });
  } catch (error) {
    console.error('[v0] Geolocation API error:', error);
    return NextResponse.json({
      success: false,
      country_code: 'KE', // Default fallback country code
      country_name: 'Kenya', // Default fallback country name
      is_african: true, // Default fallback is African
      detected: false, // Flag to indicate this is a default fallback
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            const response = NextResponse.next();
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            )
            return response;
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const ip = getClientIp(request);
    const geolocation = await detectGeolocationFromIp(ip);

    if (!geolocation) {
      return NextResponse.json(
        { error: "Could not detect geolocation" },
        { status: 400 }
      );
    }

    // Store in database
    const { error } = await supabase.rpc('update_user_location_from_ip', {
      p_user_id: user.id,
      p_ip_address: ip,
      p_country_code: geolocation.country_code,
      p_country_name: geolocation.country_name,
      p_city: geolocation.city || null,
      p_latitude: geolocation.latitude || null,
      p_longitude: geolocation.longitude || null,
    });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: "Geolocation stored",
      country_code: geolocation.country_code,
    });
  } catch (error) {
    console.error('[v0] Geolocation POST error:', error);
    return NextResponse.json(
      { error: "Failed to store geolocation" },
      { status: 500 }
    );
  }
}
