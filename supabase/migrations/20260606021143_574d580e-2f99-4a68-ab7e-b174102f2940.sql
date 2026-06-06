
-- 1) Trailers: rename existing, add Henrietta
UPDATE public.trailers SET name = 'Greece' WHERE name = 'Main Trailer';
INSERT INTO public.trailers (name, location, active)
SELECT 'Greece', 'Greece, NY', true
WHERE NOT EXISTS (SELECT 1 FROM public.trailers WHERE name = 'Greece');
INSERT INTO public.trailers (name, location, active)
SELECT 'Henrietta', 'Henrietta, NY', true
WHERE NOT EXISTS (SELECT 1 FROM public.trailers WHERE name = 'Henrietta');

-- 2) Helper: current user's trailer
CREATE OR REPLACE FUNCTION public.current_user_trailer()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT trailer_id FROM public.profiles WHERE id = auth.uid()
$$;

-- 3) Add trailer_id columns
ALTER TABLE public.inventory_items     ADD COLUMN IF NOT EXISTS trailer_id uuid;
ALTER TABLE public.shifts              ADD COLUMN IF NOT EXISTS trailer_id uuid;
ALTER TABLE public.tasks               ADD COLUMN IF NOT EXISTS trailer_id uuid;
ALTER TABLE public.tasks               ADD COLUMN IF NOT EXISTS assignee_user_id uuid;
ALTER TABLE public.hospitality_incidents ADD COLUMN IF NOT EXISTS trailer_id uuid;
ALTER TABLE public.waste_log           ADD COLUMN IF NOT EXISTS trailer_id uuid;
ALTER TABLE public.inventory_counts    ADD COLUMN IF NOT EXISTS trailer_id uuid;

-- 4) Backfill all existing rows to Greece
DO $$
DECLARE g uuid;
BEGIN
  SELECT id INTO g FROM public.trailers WHERE name = 'Greece' LIMIT 1;
  IF g IS NULL THEN RETURN; END IF;
  UPDATE public.inventory_items       SET trailer_id = g WHERE trailer_id IS NULL;
  UPDATE public.shifts                SET trailer_id = g WHERE trailer_id IS NULL;
  UPDATE public.tasks                 SET trailer_id = g WHERE trailer_id IS NULL;
  UPDATE public.hospitality_incidents SET trailer_id = g WHERE trailer_id IS NULL;
  UPDATE public.waste_log             SET trailer_id = g WHERE trailer_id IS NULL;
  UPDATE public.inventory_counts      SET trailer_id = g WHERE trailer_id IS NULL;
  UPDATE public.profiles              SET trailer_id = g WHERE trailer_id IS NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_inv_items_trailer   ON public.inventory_items(trailer_id);
CREATE INDEX IF NOT EXISTS idx_shifts_trailer      ON public.shifts(trailer_id);
CREATE INDEX IF NOT EXISTS idx_tasks_trailer       ON public.tasks(trailer_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee      ON public.tasks(assignee_user_id);
CREATE INDEX IF NOT EXISTS idx_waste_trailer       ON public.waste_log(trailer_id);
CREATE INDEX IF NOT EXISTS idx_inv_counts_trailer  ON public.inventory_counts(trailer_id);
CREATE INDEX IF NOT EXISTS idx_hosp_inc_trailer    ON public.hospitality_incidents(trailer_id);

-- 5) Tighten RLS — crew restricted to their trailer; managers/owners see all
-- inventory_items
DROP POLICY IF EXISTS "items read" ON public.inventory_items;
CREATE POLICY "items read scoped" ON public.inventory_items FOR SELECT TO authenticated
  USING (is_manager(auth.uid()) OR trailer_id = current_user_trailer());

-- shifts
DROP POLICY IF EXISTS "shifts read" ON public.shifts;
CREATE POLICY "shifts read scoped" ON public.shifts FOR SELECT TO authenticated
  USING (is_manager(auth.uid()) OR trailer_id = current_user_trailer() OR trailer_id IS NULL);

-- tasks
DROP POLICY IF EXISTS "tasks read" ON public.tasks;
CREATE POLICY "tasks read scoped" ON public.tasks FOR SELECT TO authenticated
  USING (
    is_manager(auth.uid())
    OR trailer_id = current_user_trailer()
    OR trailer_id IS NULL
    OR assignee_user_id = auth.uid()
  );

-- waste_log
DROP POLICY IF EXISTS "waste read" ON public.waste_log;
CREATE POLICY "waste read scoped" ON public.waste_log FOR SELECT TO authenticated
  USING (is_manager(auth.uid()) OR trailer_id = current_user_trailer() OR trailer_id IS NULL);

-- inventory_counts
DROP POLICY IF EXISTS "counts read" ON public.inventory_counts;
CREATE POLICY "counts read scoped" ON public.inventory_counts FOR SELECT TO authenticated
  USING (is_manager(auth.uid()) OR trailer_id = current_user_trailer() OR trailer_id IS NULL);

-- hospitality_incidents
DROP POLICY IF EXISTS "incidents read" ON public.hospitality_incidents;
CREATE POLICY "incidents read scoped" ON public.hospitality_incidents FOR SELECT TO authenticated
  USING (is_manager(auth.uid()) OR trailer_id = current_user_trailer() OR trailer_id IS NULL);

-- 6) SOP versions + attachments
CREATE TABLE IF NOT EXISTS public.sop_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sop_id uuid NOT NULL REFERENCES public.sops(id) ON DELETE CASCADE,
  version int NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  category text NOT NULL,
  role app_role,
  pass_standard text,
  edited_by uuid,
  edited_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.sop_versions TO authenticated;
GRANT ALL ON public.sop_versions TO service_role;
ALTER TABLE public.sop_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sop_versions read" ON public.sop_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "sop_versions write mgr" ON public.sop_versions FOR INSERT TO authenticated
  WITH CHECK (is_manager(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_sop_versions_sop ON public.sop_versions(sop_id, version DESC);

CREATE TABLE IF NOT EXISTS public.sop_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sop_id uuid NOT NULL REFERENCES public.sops(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  label text,
  content_type text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.sop_attachments TO authenticated;
GRANT ALL ON public.sop_attachments TO service_role;
ALTER TABLE public.sop_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sop_att read" ON public.sop_attachments FOR SELECT TO authenticated USING (true);
CREATE POLICY "sop_att write mgr" ON public.sop_attachments FOR INSERT TO authenticated
  WITH CHECK (is_manager(auth.uid()) AND uploaded_by = auth.uid());
CREATE POLICY "sop_att delete mgr" ON public.sop_attachments FOR DELETE TO authenticated
  USING (is_manager(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_sop_att_sop ON public.sop_attachments(sop_id);

-- Storage policies for gotham-photos bucket — sop attachments path prefix
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'sop_photos_read') THEN
    CREATE POLICY "sop_photos_read" ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'gotham-photos');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'sop_photos_write_mgr') THEN
    CREATE POLICY "sop_photos_write_mgr" ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'gotham-photos' AND public.is_manager(auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'sop_photos_delete_mgr') THEN
    CREATE POLICY "sop_photos_delete_mgr" ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'gotham-photos' AND public.is_manager(auth.uid()));
  END IF;
END $$;
