-- Prevent double clock-in at the database level: at most one open punch per employee
CREATE UNIQUE INDEX IF NOT EXISTS time_punches_one_open_per_employee
  ON public.time_punches (employee_id)
  WHERE status = 'open';