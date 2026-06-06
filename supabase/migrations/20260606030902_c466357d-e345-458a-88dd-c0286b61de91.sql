
-- Auto-fill trailer_id on schedule_shifts and time_punches; backfill existing rows

-- Backfill schedule_shifts trailer from employee profile, then schedule
UPDATE public.schedule_shifts s
SET trailer_id = COALESCE(
  (SELECT p.trailer_id FROM public.profiles p WHERE p.id = s.employee_id),
  (SELECT sc.trailer_id FROM public.schedules sc WHERE sc.id = s.schedule_id)
)
WHERE s.trailer_id IS NULL;

-- Backfill time_punches trailer from employee profile
UPDATE public.time_punches tp
SET trailer_id = (SELECT p.trailer_id FROM public.profiles p WHERE p.id = tp.employee_id)
WHERE tp.trailer_id IS NULL;

-- Backfill time_corrections / time_off_requests / shift_notes trailer from employee profile
UPDATE public.time_corrections t
SET trailer_id = (SELECT p.trailer_id FROM public.profiles p WHERE p.id = t.employee_id)
WHERE t.trailer_id IS NULL;
UPDATE public.time_off_requests t
SET trailer_id = (SELECT p.trailer_id FROM public.profiles p WHERE p.id = t.employee_id)
WHERE t.trailer_id IS NULL;
UPDATE public.shift_notes t
SET trailer_id = (SELECT p.trailer_id FROM public.profiles p WHERE p.id = t.employee_id)
WHERE t.trailer_id IS NULL;

-- Trigger to auto-fill schedule_shifts.trailer_id
CREATE OR REPLACE FUNCTION public.fill_schedule_shift_trailer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.trailer_id IS NULL THEN
    NEW.trailer_id := COALESCE(
      (SELECT p.trailer_id FROM public.profiles p WHERE p.id = NEW.employee_id),
      (SELECT sc.trailer_id FROM public.schedules sc WHERE sc.id = NEW.schedule_id)
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_fill_schedule_shift_trailer ON public.schedule_shifts;
CREATE TRIGGER trg_fill_schedule_shift_trailer
BEFORE INSERT OR UPDATE ON public.schedule_shifts
FOR EACH ROW EXECUTE FUNCTION public.fill_schedule_shift_trailer();

-- Trigger to auto-fill time_punches.trailer_id from employee profile
CREATE OR REPLACE FUNCTION public.fill_time_punch_trailer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.trailer_id IS NULL THEN
    NEW.trailer_id := (SELECT p.trailer_id FROM public.profiles p WHERE p.id = NEW.employee_id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_fill_time_punch_trailer ON public.time_punches;
CREATE TRIGGER trg_fill_time_punch_trailer
BEFORE INSERT OR UPDATE ON public.time_punches
FOR EACH ROW EXECUTE FUNCTION public.fill_time_punch_trailer();

-- Generic trailer fill for corrections/timeoff/notes
CREATE OR REPLACE FUNCTION public.fill_employee_trailer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.trailer_id IS NULL THEN
    NEW.trailer_id := (SELECT p.trailer_id FROM public.profiles p WHERE p.id = NEW.employee_id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_fill_corr_trailer ON public.time_corrections;
CREATE TRIGGER trg_fill_corr_trailer BEFORE INSERT OR UPDATE ON public.time_corrections
FOR EACH ROW EXECUTE FUNCTION public.fill_employee_trailer();

DROP TRIGGER IF EXISTS trg_fill_to_trailer ON public.time_off_requests;
CREATE TRIGGER trg_fill_to_trailer BEFORE INSERT OR UPDATE ON public.time_off_requests
FOR EACH ROW EXECUTE FUNCTION public.fill_employee_trailer();

DROP TRIGGER IF EXISTS trg_fill_note_trailer ON public.shift_notes;
CREATE TRIGGER trg_fill_note_trailer BEFORE INSERT OR UPDATE ON public.shift_notes
FOR EACH ROW EXECUTE FUNCTION public.fill_employee_trailer();
