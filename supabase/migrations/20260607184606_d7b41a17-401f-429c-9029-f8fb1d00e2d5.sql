
-- 1. Quiet hours columns
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS quiet_hours_start time,
  ADD COLUMN IF NOT EXISTS quiet_hours_end   time,
  ADD COLUMN IF NOT EXISTS quiet_hours_timezone text NOT NULL DEFAULT 'America/New_York';

-- 2. Weekly rollup run log
CREATE TABLE IF NOT EXISTS public.weekly_rollup_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start date NOT NULL,
  ran_at timestamptz NOT NULL DEFAULT now(),
  recipients int NOT NULL DEFAULT 0,
  enqueued int NOT NULL DEFAULT 0,
  notes text
);
GRANT SELECT ON public.weekly_rollup_runs TO authenticated;
GRANT ALL ON public.weekly_rollup_runs TO service_role;
ALTER TABLE public.weekly_rollup_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "weekly_rollup_runs read managers" ON public.weekly_rollup_runs
  FOR SELECT TO authenticated USING (public.is_manager(auth.uid()));
CREATE UNIQUE INDEX IF NOT EXISTS weekly_rollup_runs_week_idx ON public.weekly_rollup_runs(week_start);

-- 3. Schedule-published trigger
CREATE OR REPLACE FUNCTION public.emit_schedule_published_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_trailer_name text;
BEGIN
  IF NEW.status = 'published' AND (OLD.status IS DISTINCT FROM 'published') THEN
    IF public._has_open_alert('manager_note', NEW.id) THEN RETURN NEW; END IF;
    SELECT name INTO v_trailer_name FROM public.trailers WHERE id = NEW.trailer_id;
    NEW.published_at := COALESCE(NEW.published_at, now());
    INSERT INTO public.alerts (type, title, description, source_module, source_id, trailer_id,
      created_by, assigned_role, priority, status, payload)
    VALUES ('manager_note',
      'Schedule published — ' || COALESCE(v_trailer_name,'Trailer'),
      COALESCE(NEW.name,'Schedule') || ' · ' || NEW.start_date || ' → ' || NEW.end_date,
      'schedule', NEW.id, NEW.trailer_id, NEW.published_by, 'all',
      'normal', 'pending',
      jsonb_build_object('schedule_id', NEW.id, 'trailer_id', NEW.trailer_id,
        'start_date', NEW.start_date, 'end_date', NEW.end_date,
        'event', 'schedule_published'));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_emit_schedule_published_alert ON public.schedules;
CREATE TRIGGER trg_emit_schedule_published_alert
BEFORE UPDATE OF status ON public.schedules
FOR EACH ROW EXECUTE FUNCTION public.emit_schedule_published_alert();

-- 4. Lint: search_path on pgmq RPC helpers
ALTER FUNCTION public.enqueue_email(text, jsonb)        SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, int, int)  SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint)        SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;
