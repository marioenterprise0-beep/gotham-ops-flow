DROP POLICY IF EXISTS "alerts topics: owners and managers only" ON realtime.messages;
CREATE POLICY "alerts topics: owners and managers only"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  CASE
    WHEN realtime.topic() LIKE 'alerts%'
      OR realtime.topic() LIKE 'alert_category_reads%'
      OR realtime.topic() LIKE 'alert-reads%'
    THEN public.is_manager(auth.uid())
    ELSE false
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
      OR realtime.topic() LIKE 'alert-reads%'
    THEN public.is_manager(auth.uid())
    ELSE false
  END
);