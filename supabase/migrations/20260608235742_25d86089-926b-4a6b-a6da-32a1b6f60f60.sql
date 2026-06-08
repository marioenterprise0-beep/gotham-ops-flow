REVOKE ALL ON public.email_dispatch_config FROM anon, authenticated;
GRANT SELECT ON public.email_dispatch_config TO authenticated;
GRANT ALL ON public.email_dispatch_config TO service_role;

CREATE POLICY "email_dispatch_config owners read"
ON public.email_dispatch_config
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'owner'));
