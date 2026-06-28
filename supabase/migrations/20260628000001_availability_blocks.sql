-- Employee availability/unavailability blocks.
-- Crew mark days they cannot work; managers see these in the schedule grid.
create table if not exists availability_blocks (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  block_date  date        not null,
  all_day     boolean     not null default true,
  reason      text        check (char_length(reason) <= 300),
  created_at  timestamptz not null default now(),
  constraint  availability_blocks_user_date_unique unique (user_id, block_date)
);

alter table availability_blocks enable row level security;

-- Users fully manage their own blocks
create policy "avail_own_all"
  on availability_blocks
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Managers / owners / shift leads can read everyone's unavailability
create policy "avail_manager_read"
  on availability_blocks
  for select
  using (
    exists (
      select 1 from user_roles
      where user_id = auth.uid()
        and role in ('owner', 'manager', 'shift_lead')
    )
  );
