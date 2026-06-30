ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pay_rate numeric(6,2);
COMMENT ON COLUMN public.profiles.pay_rate IS 'Hourly pay rate in USD; used by labor cost calculations.';