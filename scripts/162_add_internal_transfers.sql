-- Add wallet_address to profiles if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'wallet_address') THEN
        ALTER TABLE profiles ADD COLUMN wallet_address TEXT UNIQUE;
    END IF;
END $$;

-- Function to generate wallet address (simple implementation)
CREATE OR REPLACE FUNCTION generate_wallet_address(user_id UUID)
RETURNS TEXT AS $$
BEGIN
  -- Generate a fake ETH-like address based on the user ID
  RETURN '0x' || encode(digest(user_id::text || gen_random_uuid()::text, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Populate wallet addresses for existing users
UPDATE profiles
SET wallet_address = '0x' || substring(encode(digest(id::text, 'sha256'), 'hex') from 1 for 40)
WHERE wallet_address IS NULL;

-- Make wallet_address not null after population
ALTER TABLE profiles ALTER COLUMN wallet_address SET NOT NULL;

-- Create internal transfer function
CREATE OR REPLACE FUNCTION transfer_internal(
  p_recipient_address TEXT,
  p_amount NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sender_id UUID;
  v_recipient_id UUID;
  v_sender_balance NUMERIC;
  v_coins_to_transfer RECORD;
  v_remaining_amount NUMERIC := p_amount;
  v_transfer_id UUID;
BEGIN
  v_sender_id := auth.uid();

  -- Validate amount
  IF p_amount < 50 THEN
    RAISE EXCEPTION 'Minimum transfer amount is 50 AFX';
  END IF;

  -- Find recipient
  SELECT id INTO v_recipient_id
  FROM profiles
  WHERE wallet_address = p_recipient_address
     OR email = p_recipient_address
     OR username = p_recipient_address;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recipient not found. Please check the address, email, or username.';
  END IF;

  IF v_recipient_id = v_sender_id THEN
    RAISE EXCEPTION 'Cannot transfer to yourself';
  END IF;

  -- Check sender's dashboard balance (from coins table)
  SELECT COALESCE(SUM(amount), 0)
  INTO v_sender_balance
  FROM coins
  WHERE user_id = v_sender_id
    AND status = 'available';

  IF v_sender_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance. Available: %, Required: %', v_sender_balance, p_amount;
  END IF;

  -- Deduct from sender (coins table)
  FOR v_coins_to_transfer IN
    SELECT id, amount
    FROM coins
    WHERE user_id = v_sender_id
      AND status = 'available'
    ORDER BY created_at ASC
  LOOP
    EXIT WHEN v_remaining_amount <= 0;

    IF v_coins_to_transfer.amount <= v_remaining_amount THEN
      DELETE FROM coins WHERE id = v_coins_to_transfer.id;
      v_remaining_amount := v_remaining_amount - v_coins_to_transfer.amount;
    ELSE
      UPDATE coins
      SET amount = amount - v_remaining_amount,
          updated_at = NOW()
      WHERE id = v_coins_to_transfer.id;
      v_remaining_amount := 0;
    END IF;
  END LOOP;

  -- Add to recipient (coins table)
  INSERT INTO coins (user_id, amount, claim_type, status)
  VALUES (v_recipient_id, p_amount, 'transfer', 'available');

  -- Update dashboard balances in profiles table for quick access
  UPDATE profiles SET dashboard_balance = dashboard_balance - p_amount WHERE id = v_sender_id;
  UPDATE profiles SET dashboard_balance = dashboard_balance + p_amount WHERE id = v_recipient_id;

  -- Log transactions
  INSERT INTO transactions (user_id, type, amount, description, status, related_id)
  VALUES 
    (v_sender_id, 'transfer_sent', -p_amount, 'Sent to ' || p_recipient_address, 'completed', v_recipient_id),
    (v_recipient_id, 'transfer_received', p_amount, 'Received from ' || (SELECT email FROM profiles WHERE id = v_sender_id), 'completed', v_sender_id);

  RETURN jsonb_build_object(
    'success', true,
    'amount', p_amount,
    'recipient', p_recipient_address
  );
END;
$$;
