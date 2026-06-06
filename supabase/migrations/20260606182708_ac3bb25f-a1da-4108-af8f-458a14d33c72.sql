
CREATE TABLE public.alert_category_reads (
  user_id uuid NOT NULL,
  category text NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, category)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.alert_category_reads TO authenticated;
GRANT ALL ON public.alert_category_reads TO service_role;

ALTER TABLE public.alert_category_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alert_category_reads self read"
  ON public.alert_category_reads FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "alert_category_reads self upsert"
  ON public.alert_category_reads FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "alert_category_reads self update"
  ON public.alert_category_reads FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.alert_category_reads;
