delete from public.email_send_log where status = 'pending';
update public.alerts
set email_status = 'none', email_template = null, email_error = null
where id in (
  'd558c33a-bce5-4127-b891-d4bea75d91c4',
  'b8e49ba1-6828-4374-a038-396d05429762'
);