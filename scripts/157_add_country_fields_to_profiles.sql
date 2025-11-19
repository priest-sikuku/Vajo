-- Add country and currency fields to profiles table if they don't exist
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS country_code VARCHAR(3);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS country_name VARCHAR(100);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS currency_code VARCHAR(3);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS currency_symbol VARCHAR(10);

-- Create index for faster lookups by country
CREATE INDEX IF NOT EXISTS idx_profiles_country ON profiles(country_code);

-- Comment on columns
COMMENT ON COLUMN profiles.country_code IS 'ISO 3166-1 alpha-2 country code';
COMMENT ON COLUMN profiles.country_name IS 'Full name of the country';
COMMENT ON COLUMN profiles.currency_code IS 'ISO 4217 currency code';
COMMENT ON COLUMN profiles.currency_symbol IS 'Symbol of the currency';
