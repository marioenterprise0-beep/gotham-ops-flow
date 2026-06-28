-- Crew can claim open (unassigned) shifts; managers approve/decline.
create table if not exists shift_claim_requests (
  id               uuid        primary key default gen_random_uuid(),
  schedule_shift_id uuid       not null references schedule_shifts(id) on delete cascade,
  claimant_id      uuid        not null references auth.users(id) on delete cascade,
  trailer_id       uuid        references trailers(id),
  reason           text        check (char_length(reason) <= 500),
  status           text        not null default 'pending'
                               check (status in ('pending','approved','declined','cancelled')),
  decided_by       uuid        references auth.users(id),
  decided_at       timestamptz,
  decision_note    text        check (char_length(decision_note) <= 500),
  created_at       timestamptz not null default now(),
  archived_at      timestamptz
);

alter table shift_claim_requests enable row level security;

-- Crew can create and view their own claim requests
create policy "claims_own"
  on shift_claim_requests for all
  using  (auth.uid() = claimant_id)
  with check (auth.uid() = claimant_id);

-- Managers can read and update all claim requests
create policy "claims_manager_all"
  on shift_claim_requests for all
  using (
    exists (
      select 1 from user_roles
      where user_id = auth.uid()
        and role in ('owner', 'manager', 'shift_lead')
    )
  );
