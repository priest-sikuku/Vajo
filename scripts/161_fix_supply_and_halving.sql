-- Fix global supply deduction and update halving countdown to 25 days

-- 1. Create or replace the deduct_from_global_supply function
CREATE OR REPLACE FUNCTION deduct_from_global_supply(mining_amount NUMERIC)
RETURNS TABLE (
  success BOOLEAN,
  remaining NUMERIC,
  message TEXT
) AS $$
DECLARE
  v_current_supply NUMERIC;
  v_actual_amount NUMERIC;
BEGIN
  -- Get current remaining supply
  SELECT remaining_supply INTO v_current_supply
  FROM global_supply
  WHERE id = 1
  FOR UPDATE;

  -- Check if there's enough supply
  IF v_current_supply IS NULL THEN
    RETURN QUERY SELECT FALSE, 0::NUMERIC, 'Global supply not initialized'::TEXT;
    RETURN;
  END IF;

  IF v_current_supply <= 0 THEN
    RETURN QUERY SELECT FALSE, 0::NUMERIC, 'Global supply exhausted'::TEXT;
    RETURN;
  END IF;

  -- Calculate actual amount to give (min of requested and available)
  v_actual_amount := LEAST(mining_amount, v_current_supply);

  -- Deduct from remaining supply and add to mined supply
  UPDATE global_supply
  SET 
    remaining_supply = remaining_supply - v_actual_amount,
    mined_supply = mined_supply + v_actual_amount,
    updated_at = NOW()
  WHERE id = 1;

  -- Return success with actual amount
  RETURN QUERY SELECT TRUE, v_actual_amount, 'Supply deducted successfully'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Ensure global_supply table has initial data if missing
INSERT INTO global_supply (id, total_supply, remaining_supply, mined_supply, updated_at)
VALUES (1, 1000000, 1000000, 0, NOW())
ON CONFLICT (id) DO NOTHING;

-- 3. Update halving date to 25 days from now
UPDATE mining_config
SET 
  halving_date = NOW() + INTERVAL '25 days',
  updated_at = NOW()
WHERE id = (SELECT id FROM mining_config ORDER BY created_at DESC LIMIT 1);

-- If no mining_config exists, create one
INSERT INTO mining_config (reward_amount, interval_hours, halving_date, post_halving_reward)
SELECT 0.5, 5, NOW() + INTERVAL '25 days', 0.15
WHERE NOT EXISTS (SELECT 1 FROM mining_config);

COMMENT ON FUNCTION deduct_from_global_supply IS 'Deducts mining amount from global supply and returns actual amount given';
