-- Allow employees to read any schedule that contains a shift assigned to them,
-- even when their profile's trailer_id isn't set yet (common for new hires).
DROP POLICY IF EXISTS "schedules read scoped" ON public.schedules;
CREATE POLICY "schedules read scoped" ON public.schedules
  FOR SELECT TO authenticated
  USING (
    is_manager(auth.uid())
    OR trailer_id = current_user_trailer()
    OR trailer_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.schedule_shifts ss
      WHERE ss.schedule_id = schedules.id
        AND ss.employee_id = auth.uid()
    )
  );