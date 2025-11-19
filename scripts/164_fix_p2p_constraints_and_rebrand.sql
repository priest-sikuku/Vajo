-- Fix P2P Constraints and Complete Rebranding
-- 1. Remove old "gx" constraint referencing 50 minimum
-- 2. Update all "gx" references to "afx" 
-- 3. Set new minimum to 5 AFX

-- Drop old constraint with gx reference
ALTER TABLE public.p2p_ads DROP CONSTRAINT IF EXISTS check_min_gx_amount;
ALTER TABLE public.p2p_ads DROP CONSTRAINT IF EXISTS check_min_afx_amount;

-- Add new constraint with 5 AFX minimum
ALTER TABLE public.p2p_ads 
ADD CONSTRAINT check_min_afx_amount CHECK (afx_amount >= 5);

-- Drop old trade constraint
ALTER TABLE public.p2p_trades DROP CONSTRAINT IF EXISTS check_min_trade_amount;
ALTER TABLE public.p2p_trades DROP CONSTRAINT IF EXISTS check_min_trade_afx_amount;

-- Add new trade constraint with 1 AFX minimum
ALTER TABLE public.p2p_trades 
ADD CONSTRAINT check_min_trade_afx_amount CHECK (afx_amount >= 1);

-- Update post_sell_ad function to check 5 AFX minimum instead of 50
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
  v_user_balance NUMERIC;
BEGIN
  -- Check minimum is 5 AFX instead of 50
  IF p_afx_amount < 5 THEN
    RAISE EXCEPTION 'Minimum amount to post an ad is 5 AFX';
  END IF;

  -- Check user has enough balance in coins table
  SELECT COALESCE(SUM(amount), 0) INTO v_user_balance
  FROM public.coins
  WHERE user_id = p_user_id AND status = 'available';

  IF v_user_balance < p_afx_amount THEN
    RAISE EXCEPTION 'Insufficient balance. You have % AFX available', v_user_balance;
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

  -- Lock the coins for this ad
  UPDATE public.coins
  SET status = 'locked',
      updated_at = NOW()
  WHERE user_id = p_user_id 
    AND status = 'available'
    AND id IN (
      SELECT id FROM public.coins
      WHERE user_id = p_user_id AND status = 'available'
      ORDER BY created_at ASC
      LIMIT (
        SELECT COUNT(*) FROM public.coins
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
    'Created sell ad - coins locked',
    v_ad_id,
    'completed'
  );

  RETURN v_ad_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update initiate_p2p_trade function to use AFX terminology and 1 AFX minimum
CREATE OR REPLACE FUNCTION initiate_p2p_trade(
  p_ad_id UUID,
  p_buyer_id UUID,
  p_seller_id UUID,
  p_afx_amount NUMERIC
)
RETURNS UUID AS $$
DECLARE
  v_trade_id UUID;
  v_ad_remaining NUMERIC;
  v_seller_balance NUMERIC;
BEGIN
  -- Check minimum trade amount is 1 AFX
  IF p_afx_amount < 1 THEN
    RAISE EXCEPTION 'Minimum trade amount is 1 AFX';
  END IF;

  -- Prevent self-trading
  IF p_buyer_id = p_seller_id THEN
    RAISE EXCEPTION 'Cannot trade with yourself';
  END IF;

  -- Get ad remaining amount
  SELECT remaining_amount INTO v_ad_remaining
  FROM p2p_ads
  WHERE id = p_ad_id AND status = 'active';

  IF v_ad_remaining IS NULL THEN
    RAISE EXCEPTION 'Ad not found or inactive';
  END IF;

  IF p_afx_amount > v_ad_remaining THEN
    RAISE EXCEPTION 'Requested amount exceeds available amount';
  END IF;

  -- Get seller balance from coins table
  SELECT COALESCE(SUM(amount), 0) INTO v_seller_balance
  FROM coins
  WHERE user_id = p_seller_id AND status = 'locked';

  IF v_seller_balance < p_afx_amount THEN
    RAISE EXCEPTION 'Seller has insufficient balance';
  END IF;

  -- Create trade
  INSERT INTO p2p_trades (
    ad_id,
    buyer_id,
    seller_id,
    afx_amount,
    escrow_amount,
    status,
    expires_at
  ) VALUES (
    p_ad_id,
    p_buyer_id,
    p_seller_id,
    p_afx_amount,
    p_afx_amount,
    'pending',
    NOW() + INTERVAL '30 minutes'
  ) RETURNING id INTO v_trade_id;

  -- Decrease remaining_amount on the ad
  UPDATE p2p_ads
  SET remaining_amount = remaining_amount - p_afx_amount,
      status = CASE 
        WHEN remaining_amount - p_afx_amount <= 0 THEN 'completed'
        ELSE status
      END
  WHERE id = p_ad_id;

  RETURN v_trade_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION post_sell_ad_with_payment_details IS 'Creates a sell ad with 5 AFX minimum';
COMMENT ON FUNCTION initiate_p2p_trade IS 'Initiates a P2P trade with 1 AFX minimum';
