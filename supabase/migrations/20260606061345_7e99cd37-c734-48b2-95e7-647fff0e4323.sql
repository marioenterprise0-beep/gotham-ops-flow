
CREATE TABLE IF NOT EXISTS public.change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid,
  actor_name text,
  entity text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  summary text,
  before jsonb,
  after jsonb,
  reason text,
  trailer_id uuid
);
CREATE INDEX IF NOT EXISTS change_log_created_idx ON public.change_log (created_at DESC);
CREATE INDEX IF NOT EXISTS change_log_entity_idx ON public.change_log (entity, entity_id);
CREATE INDEX IF NOT EXISTS change_log_actor_idx ON public.change_log (actor_id);

GRANT SELECT, INSERT ON public.change_log TO authenticated;
GRANT ALL ON public.change_log TO service_role;

ALTER TABLE public.change_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "change_log read mgr+owner" ON public.change_log
  FOR SELECT TO authenticated USING (public.is_manager(auth.uid()));
CREATE POLICY "change_log insert auth" ON public.change_log
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL AND (actor_id = auth.uid() OR actor_id IS NULL));
