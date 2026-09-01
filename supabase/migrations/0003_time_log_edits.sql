-- Migration: time-entry edits with lead approval
-- Users request edits / additions / deletions to their time entries; a lead
-- approves, at which point the change is applied and the entry flagged modified.
-- Additive and idempotent. Apply with:
--   node --env-file=.env.local scripts/apply-migration.mjs supabase/migrations/0003_time_log_edits.sql

alter table time_logs add column if not exists modified boolean not null default false;
alter table time_logs add column if not exists edited_by text references team_members(id) on delete set null;
alter table time_logs add column if not exists edited_at timestamptz;

create table if not exists time_log_change_requests (
  id text primary key,
  time_log_id text references time_logs(id) on delete set null, -- null for 'add' / after an approved delete
  user_id text references team_members(id) on delete cascade,   -- requester (entry owner)
  type text not null check (type in ('edit', 'add', 'delete')),
  -- proposed fields for edit/add: {project_id, task_id, date, start_time, end_time, note}
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewer_id text references team_members(id) on delete set null,
  reviewed_at timestamptz,
  note text not null default '',        -- requester's reason
  review_note text not null default '', -- reviewer's note
  created_at timestamptz not null default now()
);
create index if not exists tlcr_status_idx on time_log_change_requests(status);
create index if not exists tlcr_user_idx on time_log_change_requests(user_id);

alter table time_log_change_requests enable row level security;
drop policy if exists tlcr_anon_all on time_log_change_requests;
create policy tlcr_anon_all on time_log_change_requests
  for all to anon, authenticated using (true) with check (true);

do $$
begin
  alter publication supabase_realtime add table time_log_change_requests;
exception when duplicate_object then null;
end $$;
