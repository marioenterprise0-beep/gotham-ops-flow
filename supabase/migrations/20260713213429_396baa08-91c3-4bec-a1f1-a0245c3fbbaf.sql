
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
      AND p.proname IN (
        'audit_punch_change','check_hr_assignment_complete','emit_cash_drawer_close_alert',
        'emit_checklist_failure_alert','emit_hospitality_incident_alert','emit_inventory_order_alert',
        'emit_inventory_order_alert_after_items','emit_inventory_order_alert_insert',
        'emit_inventory_threshold_alert','emit_large_cash_drop_alert','emit_maintenance_alert',
        'emit_missed_clock_out_alert','emit_profile_milestone_alert','emit_recap_alert',
        'emit_schedule_published_alert','emit_schedule_submitted_alert','enforce_clock_in_geofence',
        'explode_hr_signature_rows','fill_employee_trailer','fill_schedule_shift_trailer',
        'fill_time_punch_trailer','handle_new_user','hr_assignment_update_guard',
        'link_time_punch_to_shift','log_task_template_version','notify_alert_email',
        'resolve_time_alerts_from_punch'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated',
                   r.proname, r.args);
  END LOOP;
END $$;
