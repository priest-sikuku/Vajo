-- Create function to post buy ad
-- This function allows users to post buy ads without locking coins
-- It handles multiple payment methods by setting the relevant columns to 'Available'

CREATE OR REPLACE FUNCTION post_buy_ad(
  p_user_id UUID,
  p_afx_amount NUMERIC,
  p_price_per_afx NUMERIC,
  p_min_amount NUMERIC,
  p_max_amount NUMERIC,
  p_mpesa_number TEXT DEFAULT NULL,
  p_paybill_number TEXT DEFAULT NULL,
  p_airtel_number TEXT DEFAULT NULL,
  p_account_number TEXT DEFAULT NULL,
  p_terms_of_trade TEXT DEFAULT NULL,
  p_country_code TEXT DEFAULT 'KE',
  p_currency_code TEXT DEFAULT 'KES'
) RETURNS UUID AS $$
DECLARE
  v_ad_id UUID;
BEGIN
  -- Create the ad
  INSERT INTO public.p2p_ads (
    user_id,
    ad_type,
    afx_amount,
    remaining_amount,
    price_per_afx,
    min_amount,
    max_amount,
    mpesa_number,
    paybill_number,
    account_number,
    airtel_money,
    terms_of_trade,
    status,
    expires_at,
    country_code,
    currency_code
  ) VALUES (
    p_user_id,
    'buy',
    p_afx_amount,
    p_afx_amount,
    p_price_per_afx,
    p_min_amount,
    p_max_amount,
    p_mpesa_number,
    p_paybill_number,
    p_account_number,
    p_airtel_number,
    p_terms_of_trade,
    'active',
    NOW() + INTERVAL '7 days',
    p_country_code,
    p_currency_code
  ) RETURNING id INTO v_ad_id;

  RETURN v_ad_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION post_buy_ad TO authenticated;

COMMENT ON FUNCTION post_buy_ad IS 'Creates a buy ad with supported payment methods';
