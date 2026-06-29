-- shift_swap_requests and prep_log were created in 20260613200000_phase2_features.sql
-- without explicit GRANT statements (only RLS policies were added). Every other
-- table in this project has explicit grants; this brings these two into line.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shift_swap_requests TO authenticated;
GRANT ALL ON public.shift_swap_requests TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prep_log TO authenticated;
GRANT ALL ON public.prep_log TO service_role;
