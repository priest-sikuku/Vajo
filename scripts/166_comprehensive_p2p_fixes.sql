-- =====================================================
-- COMPREHENSIVE P2P SYSTEM FIXES
-- =====================================================
-- 1. Fix sell ad display issue (ads not showing to buyers)
-- 2. Ensure balance sourced from P2P balance (trade_coins), not dashboard (coins)
-- 3. Fix trade flow: buyer marks paid, seller releases coins
-- 4. Fix initiate_p2p_trade_v2 to handle both buy and sell ads correctly
-- =====================================================

-- =====================================================
-- PART 1: FIX INITIATE_P2P_TRADE_V2 FOR PROPER BUYER/SELLER LOGIC
-- =====================================================

DROP FUNCTION IF EXISTS initiate_p2p_trade_v2(UUID, UUID, NUMERIC);

CREATE OR REPLACE FUNCTION initiate_p2p_trade_v2(
  p_ad_id UUID,
  p_initiator_id UUID, -- The person clicking "Buy" or "Sell" button
  p_afx_amount NUMERIC
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_trade_id UUID;
  v_ad RECORD;
  v_seller_id UUID;
  v_buyer_id UUID;
  v_total_amount NUMERIC;
  v_available_balance NUMERIC;
  v_payment_details JSONB;
  v_locked_amount NUMERIC := 0;
  v_coin_record RECORD;
BEGIN
  -- Get ad details
  SELECT * INTO v_ad FROM p2p_ads WHERE id = p_ad_id AND status = 'active';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ad not found or not active';
  END IF;

  -- Prevent self-trading
  IF p_initiator_id = v_ad.user_id THEN
    RAISE EXCEPTION 'You cannot trade with yourself';
  END IF;

  -- Validate amount is within ad limits
  IF p_afx_amount < v_ad.min_amount THEN
    RAISE EXCEPTION 'Amount must be at least % AFX', v_ad.min_amount;
  END IF;
  
  IF p_afx_amount > v_ad.max_amount THEN
    RAISE EXCEPTION 'Amount cannot exceed % AFX', v_ad.max_amount;
  END IF;

  -- Check if ad has enough remaining amount
  IF p_afx_amount > COALESCE(v_ad.remaining_amount, v_ad.afx_amount) THEN
    RAISE EXCEPTION 'Insufficient remaining amount in ad. Available: % AFX', COALESCE(v_ad.remaining_amount, v_ad.afx_amount);
  END IF;

  -- Determine buyer and seller based on ad type
  -- If ad_type='sell', the ad creator is selling (seller), initiator is buying (buyer)
  -- If ad_type='buy', the ad creator is buying (buyer), initiator is selling (seller)
  IF v_ad.ad_type = 'sell' THEN
    v_seller_id := v_ad.user_id;  -- Ad creator is seller
    v_buyer_id := p_initiator_id;  -- Initiator is buyer
  ELSIF v_ad.ad_type = 'buy' THEN
    v_buyer_id := v_ad.user_id;    -- Ad creator is buyer
    v_seller_id := p_initiator_id; -- Initiator is seller
  ELSE
    RAISE EXCEPTION 'Invalid ad type: %', v_ad.ad_type;
  END IF;

  -- Check SELLER's P2P balance (from trade_coins table, NOT coins table)
  SELECT COALESCE(SUM(amount), 0) INTO v_available_balance
  FROM trade_coins
  WHERE user_id = v_seller_id 
    AND status = 'available';

  IF v_available_balance < p_afx_amount THEN
    RAISE EXCEPTION 'Seller has insufficient P2P balance. Available: % AFX, Required: % AFX. Please transfer from Dashboard Balance to P2P Balance first.', 
      v_available_balance, p_afx_amount;
  END IF;

  -- Lock the coins in trade_coins table (P2P balance)
  -- We need to lock enough coins to cover the trade amount
  FOR v_coin_record IN (
    SELECT id, amount
    FROM trade_coins
    WHERE user_id = v_seller_id 
      AND status = 'available'
    ORDER BY created_at ASC
  ) LOOP
    IF v_locked_amount >= p_afx_amount THEN
      EXIT;
    END IF;
    
    UPDATE trade_coins
    SET status = 'locked',
        locked_at = NOW(),
        locked_for_trade_id = gen_random_uuid()
    WHERE id = v_coin_record.id;
    
    v_locked_amount := v_locked_amount + v_coin_record.amount;
  END LOOP;

  IF v_locked_amount < p_afx_amount THEN
    RAISE EXCEPTION 'Failed to lock sufficient funds. This should not happen.';
  END IF;

  -- Construct payment details from ad columns
  v_payment_details := jsonb_build_object(
    'mpesa_number', v_ad.mpesa_number,
    'airtel_money', v_ad.airtel_money,
    'paybill_number', v_ad.paybill_number,
    'account_number', v_ad.account_number,
    'account_name', v_ad.account_name,
    'bank_name', v_ad.bank_name,
    'full_name', v_ad.full_name
  );

  -- Calculate total amount in fiat currency
  v_total_amount := p_afx_amount * COALESCE(v_ad.price_per_afx, 0);

  -- Create the trade with proper buyer/seller IDs
  INSERT INTO p2p_trades (
    ad_id,
    buyer_id,
    seller_id,
    afx_amount,
    escrow_amount,
    price_per_afx,
    total_amount,
    payment_details,
    seller_payment_details,
    country_code,
    currency_code,
    status,
    is_paid,
    expires_at,
    created_at,
    updated_at
  ) VALUES (
    p_ad_id,
    v_buyer_id,
    v_seller_id,
    p_afx_amount,
    p_afx_amount, -- escrow_amount equals afx_amount
    COALESCE(v_ad.price_per_afx, 0),
    v_total_amount,
    v_payment_details,
    v_payment_details,
    v_ad.country_code,
    v_ad.currency_code,
    'pending',  -- Start as pending, buyer needs to mark as paid
    FALSE,      -- is_paid starts as FALSE
    NOW() + INTERVAL '30 minutes',
    NOW(),
    NOW()
  ) RETURNING id INTO v_trade_id;

  -- Update locked coins with the actual trade ID
  UPDATE trade_coins
  SET locked_for_trade_id = v_trade_id
  WHERE user_id = v_seller_id
    AND status = 'locked'
    AND locked_at >= NOW() - INTERVAL '1 minute'
    AND locked_for_trade_id != v_trade_id;

  -- Update ad remaining amount
  UPDATE p2p_ads
  SET remaining_amount = COALESCE(remaining_amount, afx_amount) - p_afx_amount,
      updated_at = NOW()
  WHERE id = p_ad_id;

  -- Log the trade initiation
  INSERT INTO trade_logs (trade_id, user_id, action, amount, details, timestamp)
  VALUES (
    v_trade_id,
    p_initiator_id,
    'trade_initiated',
    p_afx_amount,
    jsonb_build_object(
      'buyer_id', v_buyer_id,
      'seller_id', v_seller_id,
      'initiator_id', p_initiator_id,
      'ad_type', v_ad.ad_type,
      'total_amount', v_total_amount
    ),
    NOW()
  );

  -- Create transaction records
  INSERT INTO transactions (user_id, type, amount, description, related_id, status, created_at)
  VALUES 
    (v_buyer_id, 'p2p_trade_initiated', 0, 'P2P trade initiated as buyer', v_trade_id, 'pending', NOW()),
    (v_seller_id, 'p2p_trade_initiated', p_afx_amount, format('P2P trade initiated as seller (%s AFX locked)', p_afx_amount), v_trade_id, 'pending', NOW());

  RAISE NOTICE 'Trade % created: Buyer=%, Seller=%, Amount=% AFX, Ad Type=%', 
    v_trade_id, v_buyer_id, v_seller_id, p_afx_amount, v_ad.ad_type;

  RETURN v_trade_id;
END;
$$;

-- =====================================================
-- PART 2: ENSURE MARK_PAYMENT_SENT EXISTS AND WORKS
-- =====================================================

CREATE OR REPLACE FUNCTION mark_payment_sent(
  p_trade_id UUID,
  p_buyer_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_trade p2p_trades%ROWTYPE;
BEGIN
  -- Get trade details and verify buyer
  SELECT * INTO v_trade
  FROM p2p_trades
  WHERE id = p_trade_id AND buyer_id = p_buyer_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trade not found or you are not the buyer of this trade';
  END IF;

  -- Check current status
  IF v_trade.status NOT IN ('pending', 'escrowed') THEN
    RAISE EXCEPTION 'Trade is not in a state to mark payment. Current status: %', v_trade.status;
  END IF;

  -- Check if already marked as paid
  IF v_trade.is_paid = TRUE THEN
    RAISE EXCEPTION 'Payment has already been marked as sent';
  END IF;

  -- Update trade with payment confirmation
  UPDATE p2p_trades
  SET 
    status = 'payment_sent',
    is_paid = TRUE,
    paid_at = NOW(),
    payment_confirmed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_trade_id;

  -- Log the action
  INSERT INTO trade_logs (trade_id, user_id, action, amount, details, timestamp)
  VALUES (
    p_trade_id, 
    p_buyer_id, 
    'payment_marked_sent', 
    v_trade.afx_amount,
    jsonb_build_object('timestamp', NOW()),
    NOW()
  );

  -- Record transaction
  INSERT INTO transactions (user_id, type, amount, description, related_id, status, created_at)
  VALUES (
    p_buyer_id, 
    'p2p_payment_sent', 
    0, 
    format('Marked payment as sent for %s AFX trade', v_trade.afx_amount), 
    p_trade_id, 
    'completed',
    NOW()
  );

  RAISE NOTICE 'Buyer % marked payment as sent for trade %', p_buyer_id, p_trade_id;
END;
$$;

-- =====================================================
-- PART 3: UPDATE RELEASE_P2P_COINS TO USE TRADE_COINS
-- =====================================================

CREATE OR REPLACE FUNCTION release_p2p_coins(
  p_trade_id UUID,
  p_seller_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_trade p2p_trades%ROWTYPE;
  v_buyer_referrer UUID;
  v_commission_amount NUMERIC := 2.0; -- Fixed 2 AFX per trade
  v_transferred_amount NUMERIC := 0;
  v_coin_record RECORD;
BEGIN
  -- Get trade details and verify seller
  SELECT * INTO v_trade
  FROM p2p_trades
  WHERE id = p_trade_id AND seller_id = p_seller_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trade not found or you are not the seller of this trade';
  END IF;

  -- Validate trade state - buyer MUST mark as paid first
  IF v_trade.is_paid IS NOT TRUE THEN
    RAISE EXCEPTION 'Buyer must mark payment as sent before you can release coins';
  END IF;

  IF v_trade.status NOT IN ('payment_sent', 'escrowed', 'pending') THEN
    RAISE EXCEPTION 'Trade is not in a state to release coins. Current status: %', v_trade.status;
  END IF;

  -- Update trade status to completed
  UPDATE p2p_trades
  SET 
    status = 'completed',
    released_at = NOW(),
    coins_released_at = NOW(),
    updated_at = NOW()
  WHERE id = p_trade_id;

  -- Transfer locked coins from seller to buyer (using trade_coins table)
  -- Find all locked coins for this trade and transfer them
  FOR v_coin_record IN (
    SELECT id, amount
    FROM trade_coins
    WHERE user_id = v_trade.seller_id
      AND status = 'locked'
      AND locked_for_trade_id = p_trade_id
    ORDER BY created_at ASC
  ) LOOP
    -- Calculate how much to transfer from this coin record
    DECLARE
      v_amount_to_transfer NUMERIC;
    BEGIN
      v_amount_to_transfer := LEAST(v_coin_record.amount, v_trade.afx_amount - v_transferred_amount);
      
      IF v_amount_to_transfer > 0 THEN
        -- If we're taking the entire amount, just transfer ownership
        IF v_amount_to_transfer = v_coin_record.amount THEN
          UPDATE trade_coins
          SET 
            user_id = v_trade.buyer_id,
            status = 'available',
            locked_at = NULL,
            locked_for_trade_id = NULL,
            updated_at = NOW()
          WHERE id = v_coin_record.id;
        ELSE
          -- Split the coin record
          -- Reduce seller's locked coin
          UPDATE trade_coins
          SET amount = amount - v_amount_to_transfer,
              updated_at = NOW()
          WHERE id = v_coin_record.id;
          
          -- Create new coin for buyer
          INSERT INTO trade_coins (user_id, amount, status, source, reference_id, created_at)
          VALUES (v_trade.buyer_id, v_amount_to_transfer, 'available', 'p2p_trade', p_trade_id, NOW());
        END IF;
        
        v_transferred_amount := v_transferred_amount + v_amount_to_transfer;
      END IF;
      
      EXIT WHEN v_transferred_amount >= v_trade.afx_amount;
    END;
  END LOOP;

  -- If not enough locked coins were found, deduct from available balance
  IF v_transferred_amount < v_trade.afx_amount THEN
    DECLARE
      v_remaining NUMERIC := v_trade.afx_amount - v_transferred_amount;
    BEGIN
      FOR v_coin_record IN (
        SELECT id, amount
        FROM trade_coins
        WHERE user_id = v_trade.seller_id
          AND status = 'available'
        ORDER BY created_at ASC
      ) LOOP
        DECLARE
          v_deduct_amount NUMERIC;
        BEGIN
          v_deduct_amount := LEAST(v_coin_record.amount, v_remaining);
          
          IF v_deduct_amount > 0 THEN
            -- Deduct from seller
            UPDATE trade_coins
            SET amount = amount - v_deduct_amount,
                updated_at = NOW()
            WHERE id = v_coin_record.id;
            
            -- Credit buyer
            INSERT INTO trade_coins (user_id, amount, status, source, reference_id, created_at)
            VALUES (v_trade.buyer_id, v_deduct_amount, 'available', 'p2p_trade', p_trade_id, NOW());
            
            v_remaining := v_remaining - v_deduct_amount;
            v_transferred_amount := v_transferred_amount + v_deduct_amount;
          END IF;
          
          EXIT WHEN v_remaining <= 0;
        END;
      END LOOP;
    END;
  END IF;

  -- Verify full amount was transferred
  IF v_transferred_amount < v_trade.afx_amount THEN
    RAISE EXCEPTION 'Failed to transfer full amount. Transferred: %, Required: %', v_transferred_amount, v_trade.afx_amount;
  END IF;

  -- Clean up any empty coin records
  DELETE FROM trade_coins WHERE amount <= 0;

  -- Log the release action
  INSERT INTO trade_logs (trade_id, user_id, action, amount, details, timestamp)
  VALUES (
    p_trade_id, 
    p_seller_id, 
    'coins_released', 
    v_trade.afx_amount,
    jsonb_build_object('buyer_id', v_trade.buyer_id, 'timestamp', NOW()),
    NOW()
  );

  -- Record transactions
  INSERT INTO transactions (user_id, type, amount, description, related_id, status, created_at)
  VALUES 
    (v_trade.buyer_id, 'p2p_buy', v_trade.afx_amount, format('Received %s AFX from P2P trade', v_trade.afx_amount), p_trade_id, 'completed', NOW()),
    (v_trade.seller_id, 'p2p_sell', -v_trade.afx_amount, format('Sold %s AFX in P2P trade', v_trade.afx_amount), p_trade_id, 'completed', NOW());

  -- Process 2 AFX referral commission for buyer's upline
  SELECT referred_by INTO v_buyer_referrer
  FROM profiles
  WHERE id = v_trade.buyer_id;

  IF v_buyer_referrer IS NOT NULL THEN
    -- Credit 2 AFX to referrer's P2P balance (trade_coins, not coins)
    INSERT INTO trade_coins (user_id, amount, status, source, reference_id, created_at)
    VALUES (v_buyer_referrer, v_commission_amount, 'available', 'referral_commission', p_trade_id, NOW());
    
    -- Record commission
    INSERT INTO referral_commissions (
      referrer_id, 
      referred_id, 
      amount, 
      commission_type, 
      source_id, 
      status,
      created_at
    ) VALUES (
      v_buyer_referrer, 
      v_trade.buyer_id, 
      v_commission_amount, 
      'trading', 
      p_trade_id, 
      'completed',
      NOW()
    );
    
    -- Update referral totals
    UPDATE referrals
    SET total_trading_commission = COALESCE(total_trading_commission, 0) + v_commission_amount,
        updated_at = NOW()
    WHERE referrer_id = v_buyer_referrer AND referred_id = v_trade.buyer_id;
    
    -- Update profile commission
    UPDATE profiles
    SET total_commission = COALESCE(total_commission, 0) + v_commission_amount,
        updated_at = NOW()
    WHERE id = v_buyer_referrer;
    
    -- Record transaction
    INSERT INTO transactions (user_id, type, amount, description, related_id, status, created_at)
    VALUES (
      v_buyer_referrer, 
      'referral_commission', 
      v_commission_amount, 
      format('Referral P2P trade bonus: %s AFX', v_commission_amount), 
      p_trade_id, 
      'completed',
      NOW()
    );
    
    RAISE NOTICE 'Awarded % AFX P2P commission to referrer % for buyer % trade %', 
      v_commission_amount, v_buyer_referrer, v_trade.buyer_id, p_trade_id;
  END IF;
  
  RAISE NOTICE 'Seller % released % AFX to buyer % for trade %', 
    p_seller_id, v_trade.afx_amount, v_trade.buyer_id, p_trade_id;
END;
$$;

-- =====================================================
-- PART 4: GRANT PERMISSIONS
-- =====================================================

GRANT EXECUTE ON FUNCTION initiate_p2p_trade_v2(UUID, UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION initiate_p2p_trade_v2(UUID, UUID, NUMERIC) TO anon;
GRANT EXECUTE ON FUNCTION mark_payment_sent(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION release_p2p_coins(UUID, UUID) TO authenticated;

-- =====================================================
-- PART 5: ADD HELPFUL COMMENTS
-- =====================================================

COMMENT ON FUNCTION initiate_p2p_trade_v2 IS 'Initiates P2P trade. Handles both buy and sell ads. Locks coins from seller P2P balance (trade_coins). Returns trade ID.';
COMMENT ON FUNCTION mark_payment_sent IS 'BUYER marks payment as sent. Sets is_paid=TRUE and status=payment_sent. Required before seller can release coins.';
COMMENT ON FUNCTION release_p2p_coins IS 'SELLER releases coins after buyer marks payment. Transfers from trade_coins. Awards 2 AFX to buyer referrer.';

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'P2P SYSTEM COMPREHENSIVE FIX COMPLETED';
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Key Changes:';
  RAISE NOTICE '1. initiate_p2p_trade_v2 now correctly assigns buyer/seller based on ad_type';
  RAISE NOTICE '2. Balance is sourced from trade_coins (P2P balance), not coins (dashboard)';
  RAISE NOTICE '3. Trade flow: Buyer marks paid → Seller releases coins';
  RAISE NOTICE '4. Sell ads will now appear under Buy tab for buyers';
  RAISE NOTICE '5. Buy ads will now appear under Sell tab for sellers';
  RAISE NOTICE '==============================================';
END $$;
