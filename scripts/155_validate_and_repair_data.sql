-- Data validation and repair script

-- Check for orphaned records without country codes
SELECT COUNT(*) as orphaned_ads
FROM p2p_ads
WHERE country_code IS NULL OR country_code = '';

SELECT COUNT(*) as orphaned_trades
FROM p2p_trades
WHERE country_code IS NULL OR country_code = '';

SELECT COUNT(*) as orphaned_profiles
FROM profiles
WHERE country_code IS NULL AND detected_country_code IS NULL;

-- Fix orphaned records with default country (KE)
UPDATE p2p_ads
SET country_code = 'KE'
WHERE country_code IS NULL OR country_code = '';

UPDATE p2p_trades
SET country_code = 'KE'
WHERE country_code IS NULL OR country_code = '';

UPDATE profiles
SET country_code = 'KE', currency_code = 'KES', currency_symbol = 'KSh'
WHERE country_code IS NULL AND detected_country_code IS NULL;

-- Validate constraint violations
DELETE FROM p2p_ads
WHERE country_code NOT IN ('KE', 'UG', 'TZ', 'GH', 'NG', 'ZA', 'ZM', 'BJ', NULL);

DELETE FROM p2p_trades
WHERE country_code NOT IN ('KE', 'UG', 'TZ', 'GH', 'NG', 'ZA', 'ZM', 'BJ', NULL);

-- Ensure currency codes match country
UPDATE profiles
SET
  currency_code = CASE country_code
    WHEN 'KE' THEN 'KES'
    WHEN 'UG' THEN 'UGX'
    WHEN 'TZ' THEN 'TZS'
    WHEN 'GH' THEN 'GHS'
    WHEN 'NG' THEN 'NGN'
    WHEN 'ZA' THEN 'ZAR'
    WHEN 'ZM' THEN 'ZMW'
    WHEN 'BJ' THEN 'XOF'
    ELSE 'KES'
  END,
  currency_symbol = CASE country_code
    WHEN 'KE' THEN 'KSh'
    WHEN 'UG' THEN 'USh'
    WHEN 'TZ' THEN 'TSh'
    WHEN 'GH' THEN 'GH₵'
    WHEN 'NG' THEN '₦'
    WHEN 'ZA' THEN 'R'
    WHEN 'ZM' THEN 'ZK'
    WHEN 'BJ' THEN 'CFA'
    ELSE 'KES'
  END
WHERE currency_code IS NULL OR currency_code = '';

-- Clean up invalid IPs
UPDATE profiles
SET ip_address = NULL
WHERE ip_address = '0.0.0.0' OR ip_address = '::1' OR ip_address = '127.0.0.1';

-- Summary report
SELECT 'Profiles with valid country' as check_name, COUNT(*) as count
FROM profiles
WHERE country_code IN ('KE', 'UG', 'TZ', 'GH', 'NG', 'ZA', 'ZM', 'BJ')
UNION ALL
SELECT 'P2P Ads with valid country', COUNT(*)
FROM p2p_ads
WHERE country_code IN ('KE', 'UG', 'TZ', 'GH', 'NG', 'ZA', 'ZM', 'BJ')
UNION ALL
SELECT 'P2P Trades with valid country', COUNT(*)
FROM p2p_trades
WHERE country_code IN ('KE', 'UG', 'TZ', 'GH', 'NG', 'ZA', 'ZM', 'BJ')
UNION ALL
SELECT 'Geolocation records', COUNT(*)
FROM user_geolocation
UNION ALL
SELECT 'Profiles with geolocation detected', COUNT(*)
FROM profiles
WHERE detected_country_code IS NOT NULL;
