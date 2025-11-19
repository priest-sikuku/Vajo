-- Enforce country-based logic and schema requirements

-- 1. Ensure profiles table has all necessary columns
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS country_code VARCHAR(3),
  ADD COLUMN IF NOT EXISTS country_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS currency_code VARCHAR(3),
  ADD COLUMN IF NOT EXISTS currency_symbol VARCHAR(10);

-- 2. Ensure p2p_ads table has country/currency columns
ALTER TABLE public.p2p_ads 
  ADD COLUMN IF NOT EXISTS country_code VARCHAR(3) DEFAULT 'KE',
  ADD COLUMN IF NOT EXISTS currency_code VARCHAR(3) DEFAULT 'KES';

-- 3. Ensure p2p_trades table has country/currency columns
ALTER TABLE public.p2p_trades 
  ADD COLUMN IF NOT EXISTS country_code VARCHAR(3) DEFAULT 'KE',
  ADD COLUMN IF NOT EXISTS currency_code VARCHAR(3) DEFAULT 'KES';

-- 4. Add constraint to enforce supported countries
-- We drop existing constraints first to avoid conflicts if they exist with different values
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS check_valid_country_code_profile;
ALTER TABLE public.profiles ADD CONSTRAINT check_valid_country_code_profile
  CHECK (country_code IS NULL OR country_code IN ('KE', 'UG', 'TZ', 'GH', 'NG', 'ZA', 'ZM', 'BJ'));

ALTER TABLE public.p2p_ads DROP CONSTRAINT IF EXISTS check_valid_country_code;
ALTER TABLE public.p2p_ads ADD CONSTRAINT check_valid_country_code
  CHECK (country_code IN ('KE', 'UG', 'TZ', 'GH', 'NG', 'ZA', 'ZM', 'BJ'));

-- 5. Update get_user_regional_p2p_ads function to be strict about country matching
CREATE OR REPLACE FUNCTION get_user_regional_p2p_ads(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  ad_type TEXT,
  afx_amount NUMERIC,
  price_per_afx NUMERIC,
  country_code VARCHAR(3),
  currency_code VARCHAR(3),
  created_at TIMESTAMP WITH TIME ZONE,
  min_amount NUMERIC,
  max_amount NUMERIC,
  remaining_amount NUMERIC,
  payment_method TEXT,
  mpesa_number TEXT,
  paybill_number TEXT,
  airtel_money TEXT,
  bank_name TEXT,
  account_number TEXT,
  account_name TEXT,
  full_name TEXT,
  terms_of_trade TEXT,
  status TEXT,
  expires_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  v_user_country VARCHAR(3);
BEGIN
  -- Get user's country from profile
  SELECT country_code INTO v_user_country
  FROM profiles
  WHERE id = p_user_id;
  
  -- Default to Kenya if not set
  IF v_user_country IS NULL THEN
    v_user_country := 'KE';
  END IF;
  
  RETURN QUERY
  SELECT
    pa.id,
    pa.user_id,
    pa.ad_type,
    pa.afx_amount,
    pa.price_per_afx,
    pa.country_code,
    pa.currency_code,
    pa.created_at,
    pa.min_amount,
    pa.max_amount,
    pa.remaining_amount,
    pa.payment_method,
    pa.mpesa_number,
    pa.paybill_number,
    pa.airtel_money,
    pa.bank_name,
    pa.account_number,
    pa.account_name,
    pa.full_name,
    pa.terms_of_trade,
    pa.status,
    pa.expires_at
  FROM p2p_ads pa
  WHERE pa.country_code = v_user_country
    AND pa.status = 'active'
    AND pa.expires_at > now()
  ORDER BY pa.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- 6. Create a function to get user's country settings
CREATE OR REPLACE FUNCTION get_user_country_settings(p_user_id UUID)
RETURNS TABLE (
  country_code VARCHAR(3),
  country_name VARCHAR(100),
  currency_code VARCHAR(3),
  currency_symbol VARCHAR(10)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.country_code,
    p.country_name,
    p.currency_code,
    p.currency_symbol
  FROM profiles p
  WHERE p.id = p_user_id;
END;
$$ LANGUAGE plpgsql;
