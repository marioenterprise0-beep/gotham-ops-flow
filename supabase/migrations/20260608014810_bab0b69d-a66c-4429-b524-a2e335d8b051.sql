
-- SOP view + acknowledgement tracking
CREATE TABLE public.sop_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sop_id uuid NOT NULL REFERENCES public.sops(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  viewed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sop_views_sop_idx ON public.sop_views(sop_id);
CREATE INDEX sop_views_user_idx ON public.sop_views(user_id);

GRANT SELECT, INSERT ON public.sop_views TO authenticated;
GRANT ALL ON public.sop_views TO service_role;
ALTER TABLE public.sop_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sop_views insert self" ON public.sop_views
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "sop_views read self or owner" ON public.sop_views
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'owner'));

CREATE TABLE public.sop_acknowledgements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sop_id uuid NOT NULL REFERENCES public.sops(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  version integer NOT NULL,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sop_id, user_id, version)
);
CREATE INDEX sop_acks_sop_idx ON public.sop_acknowledgements(sop_id);
CREATE INDEX sop_acks_user_idx ON public.sop_acknowledgements(user_id);

GRANT SELECT, INSERT ON public.sop_acknowledgements TO authenticated;
GRANT ALL ON public.sop_acknowledgements TO service_role;
ALTER TABLE public.sop_acknowledgements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sop_acks insert self" ON public.sop_acknowledgements
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "sop_acks read self or owner" ON public.sop_acknowledgements
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'owner'));
