-- Restrict realtime channel subscriptions for alert topics to owners/managers.
-- Other topics remain accessible to authenticated users (no regressions
-- to existing realtime usage).

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "alerts topics: owners and managers only" ON realtime.messages;
CREATE POLICY "alerts topics: owners and managers only"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  -- If topic is alert-related, require owner/manager role
  CASE
    WHEN realtime.topic() LIKE 'alerts%'
      OR realtime.topic() LIKE 'alert_category_reads%'
    THEN public.is_manager(auth.uid())
    ELSE true
  END
);

DROP POLICY IF EXISTS "alerts topics: owners and managers only write" ON realtime.messages;
CREATE POLICY "alerts topics: owners and managers only write"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  CASE
    WHEN realtime.topic() LIKE 'alerts%'
      OR realtime.topic() LIKE 'alert_category_reads%'
    THEN public.is_manager(auth.uid())
    ELSE true
  END
);