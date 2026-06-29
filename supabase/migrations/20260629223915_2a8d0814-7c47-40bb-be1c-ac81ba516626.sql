GRANT SELECT, INSERT, UPDATE, DELETE ON public.shift_swap_requests TO authenticated;
GRANT ALL ON public.shift_swap_requests TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prep_log TO authenticated;
GRANT ALL ON public.prep_log TO service_role;