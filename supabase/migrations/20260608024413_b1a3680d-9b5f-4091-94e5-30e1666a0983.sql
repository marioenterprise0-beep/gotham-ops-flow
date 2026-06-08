
-- 1. inventory_change_requests: split requester vs owner update rights
DROP POLICY IF EXISTS "inv_change_req owner update" ON public.inventory_change_requests;
CREATE POLICY "inv_change_req requester update pending"
  ON public.inventory_change_requests FOR UPDATE TO authenticated
  USING (requested_by = auth.uid() AND status = 'pending')
  WITH CHECK (requested_by = auth.uid() AND status = 'pending');
CREATE POLICY "inv_change_req owner decide"
  ON public.inventory_change_requests FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role))
  WITH CHECK (has_role(auth.uid(), 'owner'::app_role));

-- 2. location_access_requests: requester can only cancel own pending; only owner can approve
DROP POLICY IF EXISTS "loc_req update" ON public.location_access_requests;
CREATE POLICY "loc_req requester cancel pending"
  ON public.location_access_requests FOR UPDATE TO authenticated
  USING (requested_by = auth.uid() AND status = 'pending')
  WITH CHECK (requested_by = auth.uid() AND status IN ('pending','cancelled'));
CREATE POLICY "loc_req owner manage"
  ON public.location_access_requests FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role))
  WITH CHECK (has_role(auth.uid(), 'owner'::app_role));

-- 3. time_audit: lock down inserts to service role only
DROP POLICY IF EXISTS "time_audit insert auth" ON public.time_audit;
DROP POLICY IF EXISTS "time_audit insert" ON public.time_audit;
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='time_audit' AND cmd='INSERT' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.time_audit', p.policyname);
  END LOOP;
END $$;
CREATE POLICY "time_audit service insert"
  ON public.time_audit FOR INSERT TO public
  WITH CHECK (auth.role() = 'service_role');

-- 4. checklist_sessions: scope inserts to user's trailer or managers
DROP POLICY IF EXISTS "checklist_sessions insert" ON public.checklist_sessions;
CREATE POLICY "checklist_sessions insert scoped"
  ON public.checklist_sessions FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (is_manager(auth.uid()) OR trailer_id IS NULL OR trailer_id = current_user_trailer())
  );

-- 5. tasks: scope inserts similarly
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='tasks' AND cmd='INSERT' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.tasks', p.policyname);
  END LOOP;
END $$;
CREATE POLICY "tasks insert scoped"
  ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (is_manager(auth.uid()) OR trailer_id IS NULL OR trailer_id = current_user_trailer())
  );

-- 6. waste_log: remove null-trailer exposure
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='waste_log' AND cmd='SELECT' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.waste_log', p.policyname);
  END LOOP;
END $$;
CREATE POLICY "waste_log read scoped"
  ON public.waste_log FOR SELECT TO authenticated
  USING (is_manager(auth.uid()) OR trailer_id = current_user_trailer());

-- 7. inventory_receipts: scope reads
DROP POLICY IF EXISTS "receipts read" ON public.inventory_receipts;
CREATE POLICY "receipts read scoped"
  ON public.inventory_receipts FOR SELECT TO authenticated
  USING (
    is_manager(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.inventory_items i
      WHERE i.id = inventory_receipts.item_id
        AND i.trailer_id = current_user_trailer()
    )
  );
