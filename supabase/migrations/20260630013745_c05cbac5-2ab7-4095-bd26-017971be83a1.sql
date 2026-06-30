DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='time_punches'
  ) THEN
    EXECUTE 'ALTER TABLE public.time_punches REPLICA IDENTITY FULL';
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.time_punches';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='schedule_shifts'
  ) THEN
    EXECUTE 'ALTER TABLE public.schedule_shifts REPLICA IDENTITY FULL';
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.schedule_shifts';
  END IF;
END$$;