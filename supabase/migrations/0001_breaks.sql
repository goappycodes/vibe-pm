-- Migration: breaks table
-- Additive and idempotent — safe to apply to a live database WITHOUT running the
-- destructive schema.sql (which drops every table). Apply with:
--   node --env-file=.env.local scripts/apply-migration.mjs supabase/migrations/0001_breaks.sql
--
-- Breaks are recorded mainly by the desktop timer app. They live in their own
-- table (not time_logs) so break time is never mistaken for billable work.

create table if not exists breaks (
  id text primary key,
  user_id text references team_members(id) on delete cascade,
  date date not null,
  start_time text not null default '00:00',
  end_time text not null default '00:00',
  minutes integer not null default 0,
  type text not null default 'short' check (type in ('short','lunch','other')),
  note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists breaks_user_date_idx on breaks(user_id, date);
create index if not exists breaks_date_idx on breaks(date);

-- Permissive prototype RLS, matching the rest of the schema.
alter table breaks enable row level security;
drop policy if exists breaks_anon_all on breaks;
create policy breaks_anon_all on breaks
  for all to anon, authenticated using (true) with check (true);

-- Publish changes over realtime so open dashboards sync live.
do $$
begin
  alter publication supabase_realtime add table breaks;
exception when duplicate_object then null;
end $$;
