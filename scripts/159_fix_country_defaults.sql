-- Fix country defaults and ensure user selection is respected

-- 1. Update the handle_new_user trigger to extract country info from metadata
-- This ensures the profile is created with the correct country immediately
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_country_code VARCHAR(3);
  v_country_name VARCHAR(100);
  v_currency_code VARCHAR(3);
  v_currency_symbol VARCHAR(10);
BEGIN
  -- Extract country data from metadata if available
  v_country_code := new.raw_user_meta_data ->> 'country_code';
  v_country_name := new.raw_user_meta_data ->> 'country_name';
  v_currency_code := new.raw_user_meta_data ->> 'currency_code';
  v_currency_symbol := new.raw_user_meta_data ->> 'currency_symbol';

  INSERT INTO public.profiles (
    id, 
    email, 
    username,
    country_code,
    country_name,
    currency_code,
    currency_symbol
  )
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    v_country_code,
    v_country_name,
    v_currency_code,
    v_currency_symbol
  )
  ON CONFLICT (id) DO UPDATE SET
    country_code = EXCLUDED.country_code,
    country_name = EXCLUDED.country_name,
    currency_code = EXCLUDED.currency_code,
    currency_symbol = EXCLUDED.currency_symbol
  WHERE profiles.country_code IS NULL; -- Only update if currently null

  RETURN new;
END;
$$;

-- 2. Remove hardcoded 'KE' defaults from tables to prevent silent defaulting
ALTER TABLE public.p2p_ads ALTER COLUMN country_code DROP DEFAULT;
ALTER TABLE public.p2p_trades ALTER COLUMN country_code DROP DEFAULT;

-- 3. Update get_user_regional_p2p_ads to NOT default to KE if user has a country
-- It will only default to KE if the user truly has NO country set (fallback)
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
  
  -- Only default to KE if absolutely no country is found
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

-- 4. Update get_user_primary_country to prioritize profile country
CREATE OR REPLACE FUNCTION get_user_primary_country(p_user_id UUID)
RETURNS VARCHAR(3) AS $$
DECLARE
  v_country_code VARCHAR(3);
BEGIN
  SELECT country_code INTO v_country_code FROM profiles WHERE id = p_user_id;
  
  IF v_country_code IS NOT NULL THEN
    RETURN v_country_code;
  END IF;

  -- Fallback to detected country
  SELECT detected_country_code INTO v_country_code FROM profiles WHERE id = p_user_id;
  
  IF v_country_code IS NOT NULL THEN
    RETURN v_country_code;
  END IF;

  -- Final fallback
  RETURN 'KE';
END;
$$ LANGUAGE plpgsql;
