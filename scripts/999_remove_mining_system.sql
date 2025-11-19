-- Remove all mining-related functionality from the database

-- Drop mining-related triggers first
DROP TRIGGER IF EXISTS on_mine_update_supply ON public.coins;

-- Drop mining-related functions
DROP FUNCTION IF EXISTS update_supply_on_mine();
DROP FUNCTION IF EXISTS validate_mining_claim(UUID);
DROP FUNCTION IF EXISTS process_mining_claim(UUID, NUMERIC);
DROP FUNCTION IF EXISTS get_mining_status(UUID);

-- Drop supply tracking table
DROP TABLE IF EXISTS public.supply_tracking CASCADE;

-- Remove mining-related columns from profiles table
ALTER TABLE public.profiles
DROP COLUMN IF EXISTS last_mined_at,
DROP COLUMN IF EXISTS next_mine_at,
DROP COLUMN IF EXISTS total_mined,
DROP COLUMN IF EXISTS mining_streak,
DROP COLUMN IF EXISTS last_claim_time,
DROP COLUMN IF EXISTS next_claim_time;

-- Remove mining-related indexes
DROP INDEX IF EXISTS idx_profiles_next_claim_time;
DROP INDEX IF EXISTS idx_profiles_last_claim_time;

-- Delete mining transactions from transactions table
DELETE FROM public.transactions WHERE type = 'mining';

-- Delete mining coins from coins table
DELETE FROM public.coins WHERE claim_type = 'mining';

-- Update any remaining coins with claim_type 'mining' to 'claim'
UPDATE public.coins SET claim_type = 'claim' WHERE claim_type = 'mining';
