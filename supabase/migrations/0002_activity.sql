-- Migration: activity_samples
-- Per-minute computer-activity buckets recorded by the desktop app, so admins /
-- team leads can see how a day broke down across tasks vs idle vs break time.
-- Additive and idempotent. Apply with:
--   node --env-file=.env.local scripts/apply-migration.mjs supabase/migrations/0002_activity.sql

create table if not exists activity_samples (
  id text primary key,
  user_id text references team_members(id) on delete cascade,
  date date not null,
  minute text not null,               -- "HH:MM", local wall clock
  active_seconds integer not null default 0
    check (active_seconds between 0 and 60),
  task_id text references tasks(id) on delete set null,
  on_break boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists activity_user_date_idx on activity_samples(user_id, date);
-- one bucket per user/minute (the desktop app upserts each minute in place)
create unique index if not exists activity_user_minute_uidx
  on activity_samples(user_id, date, minute);

alter table activity_samples enable row level security;
drop policy if exists activity_anon_all on activity_samples;
create policy activity_anon_all on activity_samples
  for all to anon, authenticated using (true) with check (true);

do $$
begin
  alter publication supabase_realtime add table activity_samples;
exception when duplicate_object then null;
end $$;
