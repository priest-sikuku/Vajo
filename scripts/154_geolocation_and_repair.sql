-- Comprehensive repair script for geolocation support and missing columns

-- First, check and repair profiles table for missing columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS country_code VARCHAR(3);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS country_name VARCHAR(100);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS currency_code VARCHAR(3);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS currency_symbol VARCHAR(10);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ip_address INET;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS detected_country_code VARCHAR(3);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS detected_latitude NUMERIC(10, 8);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS detected_longitude NUMERIC(11, 8);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS location_detected_at TIMESTAMP WITH TIME ZONE;

-- Create geolocation cache table
CREATE TABLE IF NOT EXISTS user_geolocation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  ip_address INET NOT NULL,
  country_code VARCHAR(3),
  country_name VARCHAR(100),
  city VARCHAR(100),
  latitude NUMERIC(10, 8),
  longitude NUMERIC(11, 8),
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, ip_address)
);

-- Create IP geolocation reference table
CREATE TABLE IF NOT EXISTS ip_geolocation_reference (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address INET NOT NULL UNIQUE,
  country_code VARCHAR(3),
  country_name VARCHAR(100),
  city VARCHAR(100),
  latitude NUMERIC(10, 8),
  longitude NUMERIC(11, 8),
  cached_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT now() + INTERVAL '90 days'
);

-- Ensure p2p_ads has all necessary columns
ALTER TABLE p2p_ads ADD COLUMN IF NOT EXISTS currency_code VARCHAR(3) DEFAULT 'KES';
ALTER TABLE p2p_ads ADD COLUMN IF NOT EXISTS country_code VARCHAR(3) DEFAULT 'KE';
ALTER TABLE p2p_ads ADD COLUMN IF NOT EXISTS ip_country_posted VARCHAR(3);

-- Ensure p2p_trades has all necessary columns
ALTER TABLE p2p_trades ADD COLUMN IF NOT EXISTS currency_code VARCHAR(3) DEFAULT 'KES';
ALTER TABLE p2p_trades ADD COLUMN IF NOT EXISTS country_code VARCHAR(3) DEFAULT 'KE';
ALTER TABLE p2p_trades ADD COLUMN IF NOT EXISTS buyer_country_code VARCHAR(3);
ALTER TABLE p2p_trades ADD COLUMN IF NOT EXISTS seller_country_code VARCHAR(3);

-- Create indexes for geolocation lookups
CREATE INDEX IF NOT EXISTS idx_user_geolocation_user_id ON user_geolocation(user_id);
CREATE INDEX IF NOT EXISTS idx_user_geolocation_country ON user_geolocation(country_code);
CREATE INDEX IF NOT EXISTS idx_ip_geolocation_ip ON ip_geolocation_reference(ip_address);
CREATE INDEX IF NOT EXISTS idx_profiles_country_code ON profiles(country_code);
CREATE INDEX IF NOT EXISTS idx_profiles_ip_address ON profiles(ip_address);
CREATE INDEX IF NOT EXISTS idx_p2p_ads_country_code ON p2p_ads(country_code);
CREATE INDEX IF NOT EXISTS idx_p2p_trades_country_code ON p2p_trades(country_code);

-- Enable RLS for new tables
ALTER TABLE user_geolocation ENABLE ROW LEVEL SECURITY;
ALTER TABLE ip_geolocation_reference ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_geolocation
CREATE POLICY IF NOT EXISTS "Users can view own geolocation" ON user_geolocation
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY IF NOT EXISTS "Users can insert own geolocation" ON user_geolocation
FOR INSERT WITH CHECK (user_id = auth.uid());

-- RLS Policies for ip_geolocation_reference (public read)
CREATE POLICY IF NOT EXISTS "Anyone can read IP geolocation reference" ON ip_geolocation_reference
FOR SELECT USING (true);

-- Function to update user location from IP
CREATE OR REPLACE FUNCTION update_user_location_from_ip(
  p_user_id UUID,
  p_ip_address INET,
  p_country_code VARCHAR(3),
  p_country_name VARCHAR(100),
  p_city VARCHAR(100),
  p_latitude NUMERIC(10, 8),
  p_longitude NUMERIC(11, 8)
) RETURNS void AS $$
BEGIN
  -- Update profiles table with detected location
  UPDATE profiles
  SET
    ip_address = p_ip_address,
    detected_country_code = p_country_code,
    detected_latitude = p_latitude,
    detected_longitude = p_longitude,
    location_detected_at = now()
  WHERE id = p_user_id;

  -- Insert into user_geolocation cache
  INSERT INTO user_geolocation (
    user_id, ip_address, country_code, country_name, city, latitude, longitude
  ) VALUES (
    p_user_id, p_ip_address, p_country_code, p_country_name, p_city, p_latitude, p_longitude
  ) ON CONFLICT (user_id, ip_address) DO NOTHING;

  -- Cache IP geolocation reference if not exists
  INSERT INTO ip_geolocation_reference (
    ip_address, country_code, country_name, city, latitude, longitude
  ) VALUES (
    p_ip_address, p_country_code, p_country_name, p_city, p_latitude, p_longitude
  ) ON CONFLICT (ip_address) DO UPDATE SET cached_at = now();
END;
$$ LANGUAGE plpgsql;

-- Function to get user's primary country (selected during signup or detected from IP)
CREATE OR REPLACE FUNCTION get_user_primary_country(p_user_id UUID)
RETURNS VARCHAR(3) AS $$
BEGIN
  RETURN COALESCE(
    (SELECT country_code FROM profiles WHERE id = p_user_id AND country_code IS NOT NULL LIMIT 1),
    (SELECT detected_country_code FROM profiles WHERE id = p_user_id AND detected_country_code IS NOT NULL LIMIT 1),
    'KE' -- Default to Kenya
  );
END;
$$ LANGUAGE plpgsql;

-- Function to get P2P ads for user's country
CREATE OR REPLACE FUNCTION get_user_regional_p2p_ads(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  ad_type TEXT,
  afx_amount NUMERIC,
  price_per_afx NUMERIC,
  country_code VARCHAR(3),
  currency_code VARCHAR(3),
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  v_user_country VARCHAR(3);
BEGIN
  v_user_country := get_user_primary_country(p_user_id);
  
  RETURN QUERY
  SELECT
    pa.id,
    pa.user_id,
    pa.ad_type,
    pa.afx_amount,
    pa.price_per_afx,
    pa.country_code,
    pa.currency_code,
    pa.created_at
  FROM p2p_ads pa
  WHERE pa.country_code = v_user_country
    AND pa.status = 'active'
    AND pa.expires_at > now()
  ORDER BY pa.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Add constraint checks to ensure data integrity
ALTER TABLE p2p_ads ADD CONSTRAINT IF NOT EXISTS check_valid_country_code
CHECK (country_code IN ('KE', 'UG', 'TZ', 'GH', 'NG', 'ZA', 'ZM', 'BJ'));

ALTER TABLE p2p_trades ADD CONSTRAINT IF NOT EXISTS check_valid_country_code_trades
CHECK (country_code IN ('KE', 'UG', 'TZ', 'GH', 'NG', 'ZA', 'ZM', 'BJ'));

ALTER TABLE profiles ADD CONSTRAINT IF NOT EXISTS check_valid_country_code_profile
CHECK (country_code IS NULL OR country_code IN ('KE', 'UG', 'TZ', 'GH', 'NG', 'ZA', 'ZM', 'BJ'));

-- Create view for user profile with location info
CREATE OR REPLACE VIEW v_user_profile_with_location AS
SELECT
  p.id,
  p.email,
  p.username,
  p.country_code,
  p.country_name,
  p.currency_code,
  p.currency_symbol,
  p.detected_country_code,
  p.ip_address,
  COALESCE(p.country_code, p.detected_country_code, 'KE') as effective_country_code,
  p.created_at,
  p.location_detected_at
FROM profiles p;
