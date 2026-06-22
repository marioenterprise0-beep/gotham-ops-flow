-- Time-off requests currently generate zero notifications at all (neither
-- on submission nor on approve/decline), and time-correction decisions
-- are silent too (only the initial request notifies anyone — the
-- time-adjustment-approved/declined templates exist but are never
-- triggered). New enum values for the decision side of each flow;
-- submission reuses the existing 'time_off'/'time_adjustment' types.
ALTER TYPE public.alert_type ADD VALUE IF NOT EXISTS 'time_off_decided';
ALTER TYPE public.alert_type ADD VALUE IF NOT EXISTS 'time_adjustment_decided';
