
-- 1) Dedupe existing unassigned coverage rows: keep oldest per (schedule, date, segment)
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY schedule_id, shift_date, segment
           ORDER BY created_at ASC, id ASC
         ) AS rn
  FROM public.schedule_shifts
  WHERE employee_id IS NULL
)
DELETE FROM public.schedule_shifts s
USING ranked r
WHERE s.id = r.id AND r.rn > 1;

-- 2) Enforce idempotency at the DB layer for unassigned coverage shifts
CREATE UNIQUE INDEX IF NOT EXISTS schedule_shifts_unassigned_unique
  ON public.schedule_shifts (schedule_id, shift_date, segment)
  WHERE employee_id IS NULL;
