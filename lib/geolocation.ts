interface GeolocationData {
  country_code: string;
  country_name: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  ip?: string;
}

const AFRICAN_COUNTRY_CODES = ['KE', 'UG', 'TZ', 'GH', 'NG', 'ZA', 'ZM', 'BJ'];

/**
 * Extract client IP from request headers
 */
export function getClientIp(request: Request | { headers: { get: (key: string) => string | null } }): string {
  const headers = 'headers' in request ? request.headers : request.headers;
  
  return (
    (headers.get('x-forwarded-for')?.split(',')[0].trim()) ||
    (headers.get('x-real-ip')) ||
    (headers.get('cf-connecting-ip')) ||
    (headers.get('x-client-ip')) ||
    'unknown'
  );
}

/**
 * Detect geolocation from IP using free geolocation API
 */
export async function detectGeolocationFromIp(ip: string): Promise<GeolocationData | null> {
  if (!ip || ip === 'unknown' || ip === '::1' || ip === '127.0.0.1') {
    return null;
  }

  try {
    // Using ip-api.com free tier (45 requests per minute)
    const response = await fetch(`https://ip-api.com/json/${ip}?fields=status,country,countryCode,city,lat,lon`, {
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!response.ok) {
      console.error('[v0] IP API error:', response.status);
      return null;
    }

    const data = await response.json();

    if (data.status !== 'success') {
      console.error('[v0] IP API unsuccessful:', data);
      return null;
    }

    // Map to African countries if applicable
    const countryCode = data.countryCode?.toUpperCase() || '';
    
    return {
      country_code: countryCode,
      country_name: data.country || '',
      city: data.city,
      latitude: data.lat,
      longitude: data.lon,
      ip,
    };
  } catch (error) {
    console.error('[v0] Geolocation detection error:', error);
    return null;
  }
}

/**
 * Determine user's primary country code
 */
export function getPrimaryCountryCode(
  selectedCountry: string | null | undefined,
  detectedCountry: string | null | undefined
): string {
  // Priority: selected country > detected country > default Kenya
  const country = selectedCountry || detectedCountry || 'KE';
  
  // Ensure it's a valid African country code
  return AFRICAN_COUNTRY_CODES.includes(country) ? country : 'KE';
}

/**
 * Get exchange rate for a country's currency to AFX
 */
export async function getExchangeRateForCountry(
  countryCode: string
): Promise<{ rate: number; currency: string } | null> {
  try {
    // This would typically call your backend API
    const response = await fetch(`/api/exchange-rates?country=${countryCode}`);
    
    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return {
      rate: data.rate || 1,
      currency: data.currency || 'KES',
    };
  } catch (error) {
    console.error('[v0] Exchange rate fetch error:', error);
    return null;
  }
}

/**
 * Check if an IP is from an African country
 */
export function isAfricanCountry(countryCode: string): boolean {
  return AFRICAN_COUNTRY_CODES.includes(countryCode?.toUpperCase() || '');
}

/**
 * Get all African country codes
 */
export function getAfricanCountryCodes(): string[] {
  return AFRICAN_COUNTRY_CODES;
}
