-- Backfill emails for existing profiles
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');

-- Update handle_new_user to populate email going forward
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_default_store uuid;
  v_default_trailer uuid;
  v_code text;
  v_invite_id uuid;
  v_role app_role;
  v_trailer uuid;
begin
  v_code := upper(coalesce(new.raw_user_meta_data->>'invite_code', ''));
  if v_code = '' then raise exception 'invite_code_required'; end if;

  select id, role, trailer_id into v_invite_id, v_role, v_trailer
    from public.invite_codes
    where upper(code) = v_code and used_by is null and disabled_at is null and expires_at > now()
    for update;
  if v_invite_id is null then raise exception 'invalid_or_expired_invite_code'; end if;

  select id into v_default_store from public.stores order by created_at asc limit 1;
  select id into v_default_trailer from public.trailers order by created_at asc limit 1;

  insert into public.profiles (id, display_name, email, store_id, trailer_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)),
    new.email,
    v_default_store,
    coalesce(v_trailer, v_default_trailer)
  );

  insert into public.user_roles (user_id, role) values (new.id, v_role);
  insert into public.notification_preferences (user_id) values (new.id) on conflict (user_id) do nothing;

  update public.invite_codes set used_by = new.id, used_at = now() where id = v_invite_id;
  insert into public.access_log (user_id, event, payload)
  values (new.id, 'invite_used', jsonb_build_object('invite_id', v_invite_id, 'role', v_role));

  return new;
end;
$function$;

-- Clean up smoke test alerts
DELETE FROM public.alerts WHERE title LIKE 'SMOKE TEST%';