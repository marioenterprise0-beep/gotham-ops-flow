DO $mig$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'stores','trailers','handbook_sections','hr_document_templates',
    'inventory_categories','role_email_policies','sops','tab_permissions',
    'automation_settings','user_roles','alerts','availability_blocks',
    'cash_drawer_sessions','cash_drawers','cash_drops','change_log',
    'checklist_sessions','daily_recaps','hospitality_incidents',
    'hr_document_assignments','inventory_change_requests','inventory_counts',
    'inventory_items','inventory_orders','invite_codes','maintenance_requests',
    'prep_log','rollover_runs','schedule_shifts','schedules',
    'shift_claim_requests','shift_notes','shift_swap_requests','shift_templates',
    'shifts','task_templates','tasks','time_corrections','time_off_requests',
    'time_punches','trusted_clock_devices','waste_log','alert_actions',
    'hr_document_signatures','hr_document_template_versions',
    'inventory_order_items','inventory_receipts','sop_acknowledgements',
    'sop_attachments','sop_versions','sop_views','task_template_versions',
    'time_audit','handbook_acknowledgements','location_access_requests',
    'active_location_grants','alert_category_reads','audit_log','access_log',
    'employee_pins'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN organization_id SET DEFAULT public.current_organization_id()',
      t
    );
  END LOOP;
END $mig$;