
-- Lock down SECURITY DEFINER fns
revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
revoke execute on function public.is_manager(uuid) from public, anon;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
grant execute on function public.is_manager(uuid) to authenticated;

-- touch_updated_at search_path
create or replace function public.touch_updated_at()
returns trigger language plpgsql
set search_path = public
as $$ begin new.updated_at = now(); return new; end $$;

-- Tighten write policies: must be signed in AND act as self/manager
drop policy if exists "shifts write" on public.shifts;
drop policy if exists "shifts update" on public.shifts;
create policy "shifts insert" on public.shifts for insert to authenticated
  with check (opened_by = auth.uid());
create policy "shifts update" on public.shifts for update to authenticated
  using (opened_by = auth.uid() or public.is_manager(auth.uid()))
  with check (true);

drop policy if exists "tasks insert" on public.tasks;
drop policy if exists "tasks update" on public.tasks;
create policy "tasks insert" on public.tasks for insert to authenticated
  with check (true);
create policy "tasks update" on public.tasks for update to authenticated
  using (owner_id = auth.uid() or owner_id is null or public.is_manager(auth.uid()))
  with check (true);

-- Storage policies for gotham-photos
create policy "photos read crew" on storage.objects for select to authenticated
  using (bucket_id = 'gotham-photos');
create policy "photos upload crew" on storage.objects for insert to authenticated
  with check (bucket_id = 'gotham-photos' and owner = auth.uid());
create policy "photos delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'gotham-photos' and owner = auth.uid());
