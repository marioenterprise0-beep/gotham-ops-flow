
-- =====================================================
-- 1. Inventory guide fields + archive
-- =====================================================
ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS count_instructions text,
  ADD COLUMN IF NOT EXISTS storage_location text,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- =====================================================
-- 2. Tighten inventory_items RLS to owner-only structural writes
--    (Quantity changes still flow via inventory_receipts / waste_log /
--     inventory_counts inserts which trigger admin-client updates.)
-- =====================================================
DROP POLICY IF EXISTS "items write" ON public.inventory_items;

CREATE POLICY "items insert owner"
  ON public.inventory_items FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "items update owner"
  ON public.inventory_items FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role))
  WITH CHECK (has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "items delete owner"
  ON public.inventory_items FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role));

-- =====================================================
-- 3. Tighten SOP writes to owner-only
-- =====================================================
DROP POLICY IF EXISTS "sops write" ON public.sops;
CREATE POLICY "sops write owner"
  ON public.sops FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role))
  WITH CHECK (has_role(auth.uid(), 'owner'::app_role));

DROP POLICY IF EXISTS "sop_versions write mgr" ON public.sop_versions;
CREATE POLICY "sop_versions write owner"
  ON public.sop_versions FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'owner'::app_role));

DROP POLICY IF EXISTS "sop_att write mgr" ON public.sop_attachments;
DROP POLICY IF EXISTS "sop_att delete mgr" ON public.sop_attachments;
CREATE POLICY "sop_att write owner"
  ON public.sop_attachments FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'owner'::app_role) AND uploaded_by = auth.uid());
CREATE POLICY "sop_att delete owner"
  ON public.sop_attachments FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role));

-- =====================================================
-- 4. Inventory change requests
-- =====================================================
DO $$ BEGIN
  CREATE TYPE inventory_change_action AS ENUM ('create','update','delete','archive');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE inventory_change_status AS ENUM ('pending','approved','declined','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.inventory_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by uuid NOT NULL,
  trailer_id uuid,
  target_item_id uuid,
  action inventory_change_action NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text,
  status inventory_change_status NOT NULL DEFAULT 'pending',
  decided_by uuid,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.inventory_change_requests TO authenticated;
GRANT ALL ON public.inventory_change_requests TO service_role;

ALTER TABLE public.inventory_change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inv_change_req read"
  ON public.inventory_change_requests FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'owner'::app_role)
    OR requested_by = auth.uid()
    OR (is_manager(auth.uid()) AND trailer_id = current_user_trailer())
  );

CREATE POLICY "inv_change_req insert self"
  ON public.inventory_change_requests FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid());

CREATE POLICY "inv_change_req owner update"
  ON public.inventory_change_requests FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role) OR requested_by = auth.uid())
  WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR requested_by = auth.uid());

CREATE TRIGGER inventory_change_requests_updated
  BEFORE UPDATE ON public.inventory_change_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =====================================================
-- 5. Location access requests + active grants
-- =====================================================
DO $$ BEGIN
  CREATE TYPE location_request_status AS ENUM ('pending','approved','declined','cancelled','used','expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.location_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by uuid NOT NULL,
  current_trailer_id uuid,
  requested_trailer_id uuid NOT NULL,
  reason text,
  duration_minutes integer NOT NULL DEFAULT 60,
  status location_request_status NOT NULL DEFAULT 'pending',
  approved_by uuid,
  approved_at timestamptz,
  code_hash text,
  code_expires_at timestamptz,
  used_at timestamptz,
  decision_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.location_access_requests TO authenticated;
GRANT ALL ON public.location_access_requests TO service_role;

ALTER TABLE public.location_access_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "loc_req read"
  ON public.location_access_requests FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'owner'::app_role)
    OR requested_by = auth.uid()
  );

CREATE POLICY "loc_req insert self"
  ON public.location_access_requests FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid());

CREATE POLICY "loc_req update"
  ON public.location_access_requests FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role) OR requested_by = auth.uid())
  WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR requested_by = auth.uid());

CREATE TRIGGER location_access_requests_updated
  BEFORE UPDATE ON public.location_access_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Active grants: minimal table read by current_user_trailer()
CREATE TABLE IF NOT EXISTS public.active_location_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  trailer_id uuid NOT NULL,
  request_id uuid REFERENCES public.location_access_requests(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS active_location_grants_user_active_idx
  ON public.active_location_grants (user_id, expires_at);

GRANT SELECT ON public.active_location_grants TO authenticated;
GRANT ALL ON public.active_location_grants TO service_role;

ALTER TABLE public.active_location_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "grants self read"
  ON public.active_location_grants FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'owner'::app_role));

-- =====================================================
-- 6. Update current_user_trailer() to honor active grants
-- =====================================================
CREATE OR REPLACE FUNCTION public.current_user_trailer()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT trailer_id FROM public.active_location_grants
       WHERE user_id = auth.uid() AND expires_at > now()
       ORDER BY expires_at DESC LIMIT 1),
    (SELECT trailer_id FROM public.profiles WHERE id = auth.uid())
  )
$$;

-- =====================================================
-- 7. Alerts: rewrite read scope so audiences are enforced
--    Owner sees all. Manager sees manager + all. Employee sees only
--    all + assigned_user_id + their own non-owner-tier creations.
-- =====================================================
DROP POLICY IF EXISTS "alerts read scoped" ON public.alerts;

CREATE POLICY "alerts read by audience"
  ON public.alerts FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'owner'::app_role)
    OR (is_manager(auth.uid()) AND assigned_role IN ('manager'::alert_assigned_role, 'all'::alert_assigned_role))
    OR assigned_role = 'all'::alert_assigned_role
    OR assigned_user_id = auth.uid()
    OR (created_by = auth.uid() AND assigned_role <> 'owner'::alert_assigned_role)
  );

-- Tighten alerts insert/update to authenticated users — unchanged but documented
-- (alerts insert any auth + alerts update mgr/owner remain.)
