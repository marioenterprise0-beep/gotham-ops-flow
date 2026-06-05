
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_default_store uuid;
  v_code text;
  v_invite_id uuid;
  v_role app_role;
begin
  v_code := upper(coalesce(new.raw_user_meta_data->>'invite_code', ''));

  if v_code = '' then
    raise exception 'invite_code_required';
  end if;

  select id, role into v_invite_id, v_role
    from public.invite_codes
    where upper(code) = v_code
      and used_by is null
      and expires_at > now()
    for update;

  if v_invite_id is null then
    raise exception 'invalid_or_expired_invite_code';
  end if;

  select id into v_default_store from public.stores order by created_at asc limit 1;

  insert into public.profiles (id, display_name, store_id)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)), v_default_store);

  insert into public.user_roles (user_id, role) values (new.id, v_role);

  update public.invite_codes
    set used_by = new.id, used_at = now()
    where id = v_invite_id;

  return new;
end;
$$;
