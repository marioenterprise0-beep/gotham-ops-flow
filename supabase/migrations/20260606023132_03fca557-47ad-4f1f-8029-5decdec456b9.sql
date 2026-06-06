
CREATE TABLE public.tab_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type text NOT NULL CHECK (scope_type IN ('role','user')),
  scope_id text NOT NULL,
  tab_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scope_type, scope_id, tab_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tab_permissions TO authenticated;
GRANT ALL ON public.tab_permissions TO service_role;

ALTER TABLE public.tab_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tab_perms owner write" ON public.tab_permissions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "tab_perms read all auth" ON public.tab_permissions
  FOR SELECT TO authenticated
  USING (true);
