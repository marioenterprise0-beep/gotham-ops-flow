-- Per-employee weekly hour target (default 40).
-- Managers can set this per crew member; schedule board uses it for the hours bar.
alter table profiles add column if not exists weekly_hours integer not null default 40
  check (weekly_hours >= 0 and weekly_hours <= 80);
