import { createClient } from '@/lib/supabase/client';
import { CountryCode, AFRICAN_COUNTRIES } from './countries';

export interface ExchangeRate {
  countryCode: CountryCode;
  currencyCode: string;
  rateToUsd: number;
  lastUpdated: string;
}

// Cache for exchange rates (refresh every 10 minutes)
let ratesCache: Record<string, number> = {};
let lastCacheUpdate = 0;
const CACHE_DURATION = 10 * 60 * 1000;

export const getUsdToLocalRate = async (currencyCode: string): Promise<number> => {
  const now = Date.now();
  if (ratesCache[currencyCode] && (now - lastCacheUpdate) < CACHE_DURATION) {
    return ratesCache[currencyCode];
  }

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('currency_rates')
      .select('rate_to_usd')
      .eq('currency_code', currencyCode)
      .single();

    if (error || !data) {
      console.warn(`[v0] Could not fetch rate for ${currencyCode}, using fallback`);
      return getFallbackUsdRate(currencyCode);
    }

    ratesCache[currencyCode] = data.rate_to_usd;
    lastCacheUpdate = now;
    return data.rate_to_usd;
  } catch (err) {
    console.error('[v0] Error fetching USD rate:', err);
    return getFallbackUsdRate(currencyCode);
  }
};

export const getFallbackUsdRate = (currencyCode: string): number => {
  const rates: Record<string, number> = {
    'KES': 130.00,
    'UGX': 3568.00,
    'NGN': 1437.00,
    'GHS': 12.50,
    'TZS': 2550.00,
    'ZAR': 18.50,
    'ZMW': 26.50,
    'XOF': 600.00
  };
  return rates[currencyCode] || 1.0;
};

// Convert AFX (base KES) to Local Currency
// Formula: (AFX_KES / KES_USD_RATE) * TARGET_USD_RATE
export const convertAfxToLocal = async (afxPriceInKes: number, targetCurrency: string): Promise<number> => {
  if (targetCurrency === 'KES') return afxPriceInKes;
  
  const kesRate = await getUsdToLocalRate('KES');
  const targetRate = await getUsdToLocalRate(targetCurrency);
  
  const priceInUsd = afxPriceInKes / kesRate;
  return priceInUsd * targetRate;
};
