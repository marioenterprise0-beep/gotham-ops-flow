
-- 1. Trusted kiosk devices (iPads registered per trailer)
CREATE TABLE public.trusted_clock_devices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trailer_id UUID NOT NULL REFERENCES public.trailers(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  approved_by UUID NOT NULL REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES auth.users(id),
  last_used_at TIMESTAMPTZ,
  last_used_ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_trusted_devices_trailer ON public.trusted_clock_devices(trailer_id) WHERE revoked_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trusted_clock_devices TO authenticated;
GRANT ALL ON public.trusted_clock_devices TO service_role;
ALTER TABLE public.trusted_clock_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "devices read manager" ON public.trusted_clock_devices FOR SELECT TO authenticated
  USING (public.is_manager(auth.uid()));
CREATE POLICY "devices insert owner" ON public.trusted_clock_devices FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "devices update owner" ON public.trusted_clock_devices FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'owner')) WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "devices delete owner" ON public.trusted_clock_devices FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));

CREATE TRIGGER touch_trusted_devices BEFORE UPDATE ON public.trusted_clock_devices
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2. Employee PINs (4-digit, bcrypt-hashed, used at kiosk)
CREATE TABLE public.employee_pins (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pin_hash TEXT NOT NULL,
  set_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- No SELECT grants: pin_hash is only ever read by service_role via server functions.
GRANT INSERT, UPDATE, DELETE ON public.employee_pins TO authenticated;
GRANT ALL ON public.employee_pins TO service_role;
ALTER TABLE public.employee_pins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pins write self or manager" ON public.employee_pins FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_manager(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_manager(auth.uid()));

CREATE TRIGGER touch_employee_pins BEFORE UPDATE ON public.employee_pins
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3. Global toggle: when true, self clock-in/out requires a trusted device token.
--    Manager/owner manual punches always work as fallback.
ALTER TABLE public.automation_settings
  ADD COLUMN IF NOT EXISTS kiosk_device_required BOOLEAN NOT NULL DEFAULT false;

-- 4. Track which device was used for each punch (audit trail)
ALTER TABLE public.time_punches
  ADD COLUMN IF NOT EXISTS clock_device_id UUID REFERENCES public.trusted_clock_devices(id);

-- 5. Helper: check whether kiosk mode is required
CREATE OR REPLACE FUNCTION public.kiosk_device_required()
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT kiosk_device_required FROM public.automation_settings WHERE scope = 'global' LIMIT 1), false)
$$;
