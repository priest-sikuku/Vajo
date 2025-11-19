-- Update mining rewards configuration
-- Base reward: 0.25 AFX
-- Post-halving reward: 0.13 AFX

UPDATE mining_config
SET 
  reward_amount = 0.25,
  post_halving_reward = 0.13,
  updated_at = NOW()
WHERE id = (SELECT id FROM mining_config ORDER BY created_at DESC LIMIT 1);

-- If no config exists, insert one with the new values
INSERT INTO mining_config (reward_amount, interval_hours, halving_date, post_halving_reward)
SELECT 0.25, 5, NOW() + INTERVAL '25 days', 0.13
WHERE NOT EXISTS (SELECT 1 FROM mining_config);
