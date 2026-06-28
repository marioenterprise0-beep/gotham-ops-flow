-- 1. Per-employee weekly hour target
alter table public.profiles add column if not exists weekly_hours integer not null default 40
  check (weekly_hours >= 0 and weekly_hours <= 80);

-- 2. Projected sales target on schedules
alter table public.schedules add column if not exists sales_target numeric(10,2) check (sales_target > 0);

-- 3. Shift claim requests
create table if not exists public.shift_claim_requests (
  id                uuid        primary key default gen_random_uuid(),
  schedule_shift_id uuid        not null references public.schedule_shifts(id) on delete cascade,
  claimant_id       uuid        not null references auth.users(id) on delete cascade,
  trailer_id        uuid        references public.trailers(id),
  reason            text        check (char_length(reason) <= 500),
  status            text        not null default 'pending'
                                check (status in ('pending','approved','declined','cancelled')),
  decided_by        uuid        references auth.users(id),
  decided_at        timestamptz,
  decision_note     text        check (char_length(decision_note) <= 500),
  created_at        timestamptz not null default now(),
  archived_at       timestamptz
);

grant select, insert, update, delete on public.shift_claim_requests to authenticated;
grant all on public.shift_claim_requests to service_role;

alter table public.shift_claim_requests enable row level security;

drop policy if exists "claims_own" on public.shift_claim_requests;
create policy "claims_own"
  on public.shift_claim_requests for all
  using  (auth.uid() = claimant_id)
  with check (auth.uid() = claimant_id);

drop policy if exists "claims_manager_all" on public.shift_claim_requests;
create policy "claims_manager_all"
  on public.shift_claim_requests for all
  using (
    exists (
      select 1 from public.user_roles
      where user_id = auth.uid()
        and role in ('owner', 'manager', 'shift_lead')
    )
  )
  with check (
    exists (
      select 1 from public.user_roles
      where user_id = auth.uid()
        and role in ('owner', 'manager', 'shift_lead')
    )
  );

create index if not exists shift_claim_requests_shift_idx on public.shift_claim_requests(schedule_shift_id);
create index if not exists shift_claim_requests_claimant_idx on public.shift_claim_requests(claimant_id);
create index if not exists shift_claim_requests_status_idx on public.shift_claim_requests(status) where archived_at is null;