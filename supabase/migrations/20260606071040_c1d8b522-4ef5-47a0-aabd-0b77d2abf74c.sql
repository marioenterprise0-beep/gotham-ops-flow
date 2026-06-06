
-- Trigger-only helpers: revoke execute from everyone (triggers fire as owner)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_punch_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.emit_inventory_order_alert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.emit_inventory_order_alert_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.emit_inventory_order_alert_after_items() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.emit_recap_alert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fill_schedule_shift_trailer() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fill_employee_trailer() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fill_time_punch_trailer() FROM PUBLIC, anon, authenticated;
