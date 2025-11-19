-- Fix post_sell_ad_with_payment_details to check trade_coins table instead of coins table
-- The P2P balance is stored in trade_coins, not coins (coins is for dashboard balance)

CREATE OR REPLACE FUNCTION post_sell_ad_with_payment_details(
  p_user_id UUID,
  p_afx_amount NUMERIC,
  p_price_per_afx NUMERIC,
  p_min_amount NUMERIC,
  p_max_amount NUMERIC,
  p_payment_method TEXT,
  p_mpesa_number TEXT DEFAULT NULL,
  p_full_name TEXT DEFAULT NULL,
  p_paybill_number TEXT DEFAULT NULL,
  p_account_number TEXT DEFAULT NULL,
  p_bank_name TEXT DEFAULT NULL,
  p_account_name TEXT DEFAULT NULL,
  p_airtel_number TEXT DEFAULT NULL,
  p_terms_of_trade TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_ad_id UUID;
  v_user_p2p_balance NUMERIC;
BEGIN
  -- Check user P2P balance from trade_coins table (not coins table)
  SELECT COALESCE(SUM(amount), 0) INTO v_user_p2p_balance
  FROM public.trade_coins
  WHERE user_id = p_user_id AND status = 'available';

  IF v_user_p2p_balance < p_afx_amount THEN
    RAISE EXCEPTION 'Insufficient P2P balance. You have % AFX available in P2P. Transfer coins from Dashboard to P2P first.', v_user_p2p_balance;
  END IF;

  -- Validate minimum amount is 5 AFX
  IF p_afx_amount < 5 THEN
    RAISE EXCEPTION 'Minimum amount to post an ad is 5 AFX';
  END IF;

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
    full_name,
    paybill_number,
    account_number,
    bank_name,
    account_name,
    airtel_money,
    terms_of_trade,
    status,
    expires_at
  ) VALUES (
    p_user_id,
    'sell',
    p_afx_amount,
    p_afx_amount,
    p_price_per_afx,
    p_min_amount,
    p_max_amount,
    p_mpesa_number,
    p_full_name,
    p_paybill_number,
    p_account_number,
    p_bank_name,
    p_account_name,
    p_airtel_number,
    p_terms_of_trade,
    'active',
    NOW() + INTERVAL '7 days'
  ) RETURNING id INTO v_ad_id;

  -- Lock the coins in trade_coins table for this ad (not coins table)
  UPDATE public.trade_coins
  SET status = 'locked',
      locked_for_trade_id = v_ad_id,
      locked_at = NOW(),
      updated_at = NOW()
  WHERE user_id = p_user_id 
    AND status = 'available'
    AND id IN (
      SELECT id FROM public.trade_coins
      WHERE user_id = p_user_id AND status = 'available'
      ORDER BY created_at ASC
      LIMIT (
        SELECT COUNT(*) FROM public.trade_coins
        WHERE user_id = p_user_id AND status = 'available'
        AND amount <= p_afx_amount
      )
    );

  -- Record transaction
  INSERT INTO public.transactions (
    user_id,
    type,
    amount,
    description,
    related_id,
    status
  ) VALUES (
    p_user_id,
    'p2p_ad_created',
    -p_afx_amount,
    'Created sell ad - coins locked in P2P balance',
    v_ad_id,
    'completed'
  );

  RETURN v_ad_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION post_sell_ad_with_payment_details TO authenticated;

COMMENT ON FUNCTION post_sell_ad_with_payment_details IS 'Creates a sell ad with payment method details. Checks and locks coins from trade_coins table (P2P balance), not coins table (dashboard balance). User must transfer from dashboard to P2P first.';
