-- Create currency_rates table to store USD to Local Currency rates
CREATE TABLE IF NOT EXISTS public.currency_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    country_code VARCHAR(2) NOT NULL,
    currency_code VARCHAR(3) NOT NULL,
    rate_to_usd NUMERIC NOT NULL, -- How much local currency for 1 USD
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(country_code, currency_code)
);

-- Enable RLS
ALTER TABLE public.currency_rates ENABLE ROW LEVEL SECURITY;

-- Allow read access to everyone
CREATE POLICY "Allow public read access" ON public.currency_rates
    FOR SELECT USING (true);

-- Allow admin update (service role)
CREATE POLICY "Allow service role update" ON public.currency_rates
    FOR ALL USING (true);

-- Insert default rates
INSERT INTO public.currency_rates (country_code, currency_code, rate_to_usd)
VALUES 
    ('KE', 'KES', 130.00),
    ('UG', 'UGX', 3568.00),
    ('NG', 'NGN', 1437.00),
    ('GH', 'GHS', 12.50),   -- Estimated
    ('TZ', 'TZS', 2550.00), -- Estimated
    ('ZA', 'ZAR', 18.50),   -- Estimated
    ('ZM', 'ZMW', 26.50),   -- Estimated
    ('BJ', 'XOF', 600.00)   -- Estimated
ON CONFLICT (country_code, currency_code) 
DO UPDATE SET rate_to_usd = EXCLUDED.rate_to_usd, updated_at = NOW();

-- Function to get AFX price in local currency
-- Assumes coin_ticks stores price in KES (as per existing system) or we define a base USD price
-- Let's assume we want to standardize. If coin_ticks is KES, we convert to USD then to Target.
CREATE OR REPLACE FUNCTION public.get_afx_price_in_currency(p_currency_code TEXT)
RETURNS NUMERIC AS $$
DECLARE
    v_kes_price NUMERIC;
    v_usd_rate_kes NUMERIC;
    v_usd_rate_target NUMERIC;
    v_usd_price NUMERIC;
BEGIN
    -- Get latest AFX price (currently in KES based on existing system)
    SELECT price INTO v_kes_price FROM public.coin_ticks ORDER BY tick_timestamp DESC LIMIT 1;
    
    IF v_kes_price IS NULL THEN
        RETURN 0;
    END IF;

    -- Get KES to USD rate (to convert base price to USD)
    SELECT rate_to_usd INTO v_usd_rate_kes FROM public.currency_rates WHERE currency_code = 'KES';
    
    -- Get Target to USD rate
    SELECT rate_to_usd INTO v_usd_rate_target FROM public.currency_rates WHERE currency_code = p_currency_code;

    IF v_usd_rate_kes IS NULL OR v_usd_rate_target IS NULL THEN
        RETURN v_kes_price; -- Fallback to raw value if conversion fails
    END IF;

    -- Convert: KES -> USD -> Target
    v_usd_price := v_kes_price / v_usd_rate_kes;
    RETURN v_usd_price * v_usd_rate_target;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
