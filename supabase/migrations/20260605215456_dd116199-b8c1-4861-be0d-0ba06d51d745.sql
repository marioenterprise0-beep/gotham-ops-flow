
create table public.invite_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  role app_role not null default 'cashier',
  created_by uuid,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  used_by uuid,
  used_at timestamptz,
  note text
);

grant select, insert, update on public.invite_codes to authenticated;
grant all on public.invite_codes to service_role;

alter table public.invite_codes enable row level security;

create policy "invite_codes managers read"
  on public.invite_codes for select to authenticated
  using (is_manager(auth.uid()));

create policy "invite_codes managers insert"
  on public.invite_codes for insert to authenticated
  with check (is_manager(auth.uid()) and created_by = auth.uid());

create policy "invite_codes managers update"
  on public.invite_codes for update to authenticated
  using (is_manager(auth.uid())) with check (is_manager(auth.uid()));

-- Consume an invite code: validates, marks used, and assigns the role to the new user.
-- Runs as definer so an authenticated brand-new user (no manager rights) can consume their own code.
create or replace function public.consume_invite_code(_code text)
returns app_role
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role app_role;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select id, role into v_id, v_role
  from public.invite_codes
  where upper(code) = upper(_code)
    and used_by is null
    and expires_at > now()
  for update;

  if v_id is null then
    raise exception 'invalid or expired invite code';
  end if;

  update public.invite_codes
    set used_by = v_uid, used_at = now()
    where id = v_id;

  -- Replace the default 'cashier' role created by handle_new_user with the invite's role
  delete from public.user_roles where user_id = v_uid;
  insert into public.user_roles (user_id, role) values (v_uid, v_role);

  return v_role;
end;
$$;

revoke all on function public.consume_invite_code(text) from public;
grant execute on function public.consume_invite_code(text) to authenticated;
