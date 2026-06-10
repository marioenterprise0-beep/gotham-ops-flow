DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['daily_recaps','shifts','tasks','task_templates','checklist_sessions','hospitality_incidents','waste_log']
  LOOP
    EXECUTE format('ALTER TABLE public.%I
      ADD COLUMN IF NOT EXISTS archived_at timestamptz,
      ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES auth.users(id),
      ADD COLUMN IF NOT EXISTS archive_reason text', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(archived_at)', t || '_archived_at_idx', t);
  END LOOP;
END $$;
