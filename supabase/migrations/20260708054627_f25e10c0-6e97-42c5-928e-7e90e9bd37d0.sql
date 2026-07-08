-- 1. Prevent any signed-in user from reading coworker emails or super-admin flags via the Data API.
REVOKE SELECT (email, is_super_admin) ON public.profiles FROM authenticated;

-- 2. Remove anon EXECUTE on internal helpers that are only called by triggers / cron / SECURITY DEFINER paths.
REVOKE EXECUTE ON FUNCTION public.kiosk_device_required() FROM anon;
REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM anon;
REVOKE EXECUTE ON FUNCTION public.email_queue_wake() FROM anon;