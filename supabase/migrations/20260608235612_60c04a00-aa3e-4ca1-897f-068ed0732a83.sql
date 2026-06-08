-- 1) Column-level privilege hardening on public.profiles
-- Revoke broad SELECT, regrant only non-sensitive columns to authenticated/anon.
REVOKE SELECT ON public.profiles FROM authenticated;
REVOKE SELECT ON public.profiles FROM anon;

GRANT SELECT (
  id, display_name, store_id, trailer_id,
  last_login_at, sop_accepted_at, training_completed_at,
  active, created_at, updated_at
) ON public.profiles TO authenticated;

-- Service role keeps full access (already covered by ALL grants, but make explicit).
GRANT SELECT ON public.profiles TO service_role;

-- 2) Realtime: allow each authenticated user to subscribe to their own
-- alert_category_reads topic so crew-side UI stays consistent.
-- Convention: client subscribes to topic "alert_category_reads:<user_id>".
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='realtime' AND tablename='messages'
      AND policyname='alert_category_reads self subscribe'
  ) THEN
    EXECUTE 'DROP POLICY "alert_category_reads self subscribe" ON realtime.messages';
  END IF;
END $$;

CREATE POLICY "alert_category_reads self subscribe"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() = 'alert_category_reads:' || auth.uid()::text
);
