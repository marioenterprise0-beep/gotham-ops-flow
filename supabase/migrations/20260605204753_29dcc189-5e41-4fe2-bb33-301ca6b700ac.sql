
-- ===== Enums =====
create type public.app_role as enum ('owner','manager','shift_lead','grill','prep','cashier');
create type public.shift_phase as enum ('opening','mid','closing','emergency');
create type public.shift_status as enum ('active','closed');
create type public.task_status as enum ('todo','in_progress','done','signed_off','blocked');
create type public.inventory_category as enum ('protein','bun','produce','sauce','packaging','supplies');
create type public.incident_severity as enum ('low','medium','high');

-- ===== Stores =====
create table public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  created_at timestamptz not null default now()
);

-- ===== Profiles =====
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Crew',
  store_id uuid references public.stores(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ===== User roles =====
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_manager(_user_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role in ('owner','manager'))
$$;

-- ===== Auto-create profile + default crew role on signup =====
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  default_store uuid;
begin
  select id into default_store from public.stores order by created_at asc limit 1;
  insert into public.profiles (id, display_name, store_id)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)), default_store);
  insert into public.user_roles (user_id, role) values (new.id, 'cashier');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at trigger fn
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger profiles_updated before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ===== Shifts =====
create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  shift_date date not null default current_date,
  phase shift_phase not null default 'opening',
  status shift_status not null default 'active',
  opened_by uuid references auth.users(id),
  opened_at timestamptz not null default now(),
  closed_by uuid references auth.users(id),
  closed_at timestamptz,
  notes text
);

-- ===== Tasks =====
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shifts(id) on delete cascade,
  phase shift_phase not null,
  title text not null,
  description text,
  assignee_role app_role,
  owner_id uuid references auth.users(id),
  status task_status not null default 'todo',
  requires_signoff boolean not null default false,
  photo_url text,
  numeric_value numeric,
  text_value text,
  signed_off_by uuid references auth.users(id),
  signed_off_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

-- ===== Inventory =====
create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  category inventory_category not null,
  unit text not null default 'unit',
  par_level numeric not null default 0,
  low_threshold numeric not null default 0,
  current_qty numeric not null default 0,
  cost_per_unit numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger inventory_items_updated before update on public.inventory_items
  for each row execute function public.touch_updated_at();

create table public.inventory_counts (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  shift_id uuid references public.shifts(id) on delete set null,
  count_qty numeric not null,
  expected_qty numeric,
  variance numeric,
  counted_by uuid references auth.users(id),
  counted_at timestamptz not null default now()
);

create table public.inventory_receipts (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  qty numeric not null,
  supplier text,
  notes text,
  received_by uuid references auth.users(id),
  received_at timestamptz not null default now()
);

create table public.waste_log (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  qty numeric not null,
  reason text not null,
  photo_url text,
  logged_by uuid references auth.users(id),
  logged_at timestamptz not null default now()
);

-- ===== SOPs =====
create table public.sops (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  role app_role,
  body text not null,
  pass_standard text,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger sops_updated before update on public.sops
  for each row execute function public.touch_updated_at();

-- ===== Hospitality =====
create table public.hospitality_incidents (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid references public.shifts(id) on delete set null,
  type text not null,
  severity incident_severity not null default 'low',
  notes text,
  recovery_action text,
  logged_by uuid references auth.users(id),
  logged_at timestamptz not null default now()
);

-- ===== Audit log =====
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  action text not null,
  entity text not null,
  entity_id uuid,
  payload jsonb,
  created_at timestamptz not null default now()
);

-- ===== Grants =====
grant select on public.stores to authenticated;
grant all on public.stores to service_role;

grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

grant select, insert, update on public.shifts to authenticated;
grant all on public.shifts to service_role;

grant select, insert, update on public.tasks to authenticated;
grant all on public.tasks to service_role;

grant select on public.inventory_items to authenticated;
grant all on public.inventory_items to service_role;

grant select, insert on public.inventory_counts to authenticated;
grant all on public.inventory_counts to service_role;

grant select, insert on public.inventory_receipts to authenticated;
grant all on public.inventory_receipts to service_role;

grant select, insert on public.waste_log to authenticated;
grant all on public.waste_log to service_role;

grant select on public.sops to authenticated;
grant all on public.sops to service_role;

grant select, insert on public.hospitality_incidents to authenticated;
grant all on public.hospitality_incidents to service_role;

grant select on public.audit_log to authenticated;
grant all on public.audit_log to service_role;

-- ===== RLS =====
alter table public.stores enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.shifts enable row level security;
alter table public.tasks enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_counts enable row level security;
alter table public.inventory_receipts enable row level security;
alter table public.waste_log enable row level security;
alter table public.sops enable row level security;
alter table public.hospitality_incidents enable row level security;
alter table public.audit_log enable row level security;

-- Stores: any signed-in crew can read; only managers can write
create policy "stores readable to crew" on public.stores for select to authenticated using (true);
create policy "stores managed by managers" on public.stores for all to authenticated
  using (public.is_manager(auth.uid())) with check (public.is_manager(auth.uid()));

-- Profiles: read all, edit self, managers edit any
create policy "profiles readable to crew" on public.profiles for select to authenticated using (true);
create policy "profiles edit self" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles managers edit any" on public.profiles for update to authenticated
  using (public.is_manager(auth.uid())) with check (public.is_manager(auth.uid()));
create policy "profiles insert self" on public.profiles for insert to authenticated
  with check (id = auth.uid());

-- User roles: read own + managers read all; only managers/owner write
create policy "roles read self" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.is_manager(auth.uid()));
create policy "roles managers write" on public.user_roles for all to authenticated
  using (public.is_manager(auth.uid())) with check (public.is_manager(auth.uid()));

-- Shifts: crew read, shift_lead+ open/close (handled in server fn); allow insert/update by any authenticated for simplicity, audit logs the actor
create policy "shifts read" on public.shifts for select to authenticated using (true);
create policy "shifts write" on public.shifts for insert to authenticated with check (true);
create policy "shifts update" on public.shifts for update to authenticated using (true) with check (true);

-- Tasks: crew read+write own; managers sign off (server enforces)
create policy "tasks read" on public.tasks for select to authenticated using (true);
create policy "tasks insert" on public.tasks for insert to authenticated with check (true);
create policy "tasks update" on public.tasks for update to authenticated using (true) with check (true);

-- Inventory items: crew read, managers write
create policy "items read" on public.inventory_items for select to authenticated using (true);
create policy "items write" on public.inventory_items for all to authenticated
  using (public.is_manager(auth.uid())) with check (public.is_manager(auth.uid()));

create policy "counts read" on public.inventory_counts for select to authenticated using (true);
create policy "counts insert" on public.inventory_counts for insert to authenticated with check (counted_by = auth.uid());

create policy "receipts read" on public.inventory_receipts for select to authenticated using (true);
create policy "receipts insert" on public.inventory_receipts for insert to authenticated with check (received_by = auth.uid());

create policy "waste read" on public.waste_log for select to authenticated using (true);
create policy "waste insert" on public.waste_log for insert to authenticated with check (logged_by = auth.uid());

create policy "sops read" on public.sops for select to authenticated using (true);
create policy "sops write" on public.sops for all to authenticated
  using (public.is_manager(auth.uid())) with check (public.is_manager(auth.uid()));

create policy "incidents read" on public.hospitality_incidents for select to authenticated using (true);
create policy "incidents insert" on public.hospitality_incidents for insert to authenticated with check (logged_by = auth.uid());

-- Audit: managers read; inserts via service role only
create policy "audit managers read" on public.audit_log for select to authenticated
  using (public.is_manager(auth.uid()));
