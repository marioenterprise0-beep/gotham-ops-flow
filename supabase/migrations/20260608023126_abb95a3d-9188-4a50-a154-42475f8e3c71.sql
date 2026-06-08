
CREATE TABLE public.role_email_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  category text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role, category)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_email_policies TO authenticated;
GRANT ALL ON public.role_email_policies TO service_role;

ALTER TABLE public.role_email_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "role_email_policies read auth"
  ON public.role_email_policies FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "role_email_policies owner write"
  ON public.role_email_policies FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'owner'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'owner'::public.app_role));

CREATE TRIGGER trg_role_email_policies_touch
  BEFORE UPDATE ON public.role_email_policies
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed defaults: owner & manager get everything; shift_lead gets most;
-- crew roles get the categories most relevant to them and the location.
INSERT INTO public.role_email_policies (role, category, enabled) VALUES
  ('owner','cash',true),('owner','inventory',true),('owner','operations',true),
  ('owner','schedule',true),('owner','time_clock',true),('owner','training',true),
  ('owner','announcements',true),('owner','critical',true),

  ('manager','cash',true),('manager','inventory',true),('manager','operations',true),
  ('manager','schedule',true),('manager','time_clock',true),('manager','training',true),
  ('manager','announcements',true),('manager','critical',true),

  ('shift_lead','cash',true),('shift_lead','inventory',true),('shift_lead','operations',true),
  ('shift_lead','schedule',true),('shift_lead','time_clock',true),('shift_lead','training',true),
  ('shift_lead','announcements',true),('shift_lead','critical',true),

  ('grill','cash',false),('grill','inventory',true),('grill','operations',true),
  ('grill','schedule',true),('grill','time_clock',true),('grill','training',true),
  ('grill','announcements',true),('grill','critical',true),

  ('prep','cash',false),('prep','inventory',true),('prep','operations',true),
  ('prep','schedule',true),('prep','time_clock',true),('prep','training',true),
  ('prep','announcements',true),('prep','critical',true),

  ('cashier','cash',true),('cashier','inventory',false),('cashier','operations',false),
  ('cashier','schedule',true),('cashier','time_clock',true),('cashier','training',true),
  ('cashier','announcements',true),('cashier','critical',true)
ON CONFLICT (role, category) DO NOTHING;
