-- Fix the handle_new_user trigger to handle all required fields properly

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_country_code VARCHAR(3);
  v_country_name VARCHAR(100);
  v_currency_code VARCHAR(3);
  v_currency_symbol VARCHAR(10);
  v_username TEXT;
  v_referral_code TEXT;
BEGIN
  -- Extract user data from metadata
  v_country_code := new.raw_user_meta_data ->> 'country_code';
  v_country_name := new.raw_user_meta_data ->> 'country_name';
  v_currency_code := new.raw_user_meta_data ->> 'currency_code';
  v_currency_symbol := new.raw_user_meta_data ->> 'currency_symbol';
  v_username := new.raw_user_meta_data ->> 'username';

  -- Generate a unique referral code (6 chars: first 3 of username + random)
  IF v_username IS NOT NULL THEN
    v_referral_code := UPPER(
      LEFT(REGEXP_REPLACE(v_username, '[^a-zA-Z0-9]', '', 'g'), 3) || 
      SUBSTRING(MD5(RANDOM()::TEXT || new.id::TEXT) FROM 1 FOR 3)
    );
  ELSE
    v_referral_code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT || new.id::TEXT) FROM 1 FOR 6));
  END IF;

  -- Make sure referral code is unique
  WHILE EXISTS (SELECT 1 FROM profiles WHERE referral_code = v_referral_code) LOOP
    v_referral_code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT || now()::TEXT) FROM 1 FOR 6));
  END LOOP;

  -- Insert profile with all required data
  INSERT INTO public.profiles (
    id, 
    email, 
    username,
    country_code,
    country_name,
    currency_code,
    currency_symbol,
    referral_code,
    created_at,
    updated_at
  )
  VALUES (
    new.id,
    new.email,
    COALESCE(v_username, split_part(new.email, '@', 1)),
    v_country_code,
    v_country_name,
    v_currency_code,
    v_currency_symbol,
    v_referral_code,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    username = COALESCE(EXCLUDED.username, profiles.username),
    country_code = COALESCE(EXCLUDED.country_code, profiles.country_code),
    country_name = COALESCE(EXCLUDED.country_name, profiles.country_name),
    currency_code = COALESCE(EXCLUDED.currency_code, profiles.currency_code),
    currency_symbol = COALESCE(EXCLUDED.currency_symbol, profiles.currency_symbol),
    referral_code = COALESCE(profiles.referral_code, EXCLUDED.referral_code),
    updated_at = now();

  RETURN new;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't block signup
    RAISE WARNING 'Error creating profile for user %: %', new.id, SQLERRM;
    RETURN new;
END;
$$;

-- Ensure trigger is properly set up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres, anon, authenticated, service_role;
