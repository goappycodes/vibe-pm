-- Vibe PM — Supabase schema
-- Text ids (u1, p1, t1…) match the app's data. Permissive RLS policies let the
-- anon key read/write for the prototype; tighten these once magic-link auth is on.

drop table if exists attachments cascade;
drop table if exists comments cascade;
drop table if exists activity_log cascade;
drop table if exists time_logs cascade;
drop table if exists day_selections cascade;
drop table if exists updates cascade;
drop table if exists task_dependencies cascade;
drop table if exists tasks cascade;
drop table if exists projects cascade;
drop table if exists clients cascade;
drop table if exists team_members cascade;
drop table if exists app_settings cascade;

create table team_members (
  id text primary key,
  name text not null,
  email text not null default '',
  avatar text,
  role text not null default 'member' check (role in ('admin','team_lead','member')),
  lead_id text,
  slack_user_id text not null default '',
  timezone text not null default 'Asia/Kolkata'
);

create table clients (
  id text primary key,
  name text not null,
  contact_name text not null default '',
  contact_email text not null default '',
  status text not null default 'active' check (status in ('active','archived')),
  color text not null default 'sky',
  created_at timestamptz not null default now()
);

create table projects (
  id text primary key,
  name text not null,
  owner_id text references team_members(id) on delete set null,
  client_id text references clients(id) on delete set null,
  status text not null default 'active' check (status in ('active','paused','done')),
  color text not null default 'indigo',
  slack_channel_id text,
  target_date date
);

create table tasks (
  id text primary key,
  project_id text references projects(id) on delete cascade,
  title text not null default '',
  description text not null default '',
  assignee_id text references team_members(id) on delete set null,
  due_date date,
  story_points integer,
  status text not null default 'todo'
    check (status in ('backlog','todo','in_progress','blocked','in_review','done')),
  urgency text not null default 'medium'
    check (urgency in ('low','medium','high','urgent')),
  "order" integer not null default 0,
  created_by text references team_members(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_project_idx on tasks(project_id);
create index tasks_assignee_idx on tasks(assignee_id);
create index tasks_status_idx on tasks(status);
create index tasks_due_idx on tasks(due_date);

create table task_dependencies (
  task_id text references tasks(id) on delete cascade,
  depends_on_task_id text references tasks(id) on delete cascade,
  type text not null default 'finish_start' check (type in ('finish_start','blocks')),
  primary key (task_id, depends_on_task_id)
);

create table updates (
  id text primary key,
  author_id text references team_members(id) on delete set null,
  source text not null check (source in ('slack','claude','ui')),
  raw_text text not null default '',
  parsed text not null default '',
  task_id text references tasks(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Tasks a member has picked to work on for a given day ("My Day" plan). Drives
-- the done-vs-pending progress on My Day and the story-point gate on /updates.
create table day_selections (
  id text primary key,
  user_id text references team_members(id) on delete cascade,
  date date not null,
  task_id text references tasks(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, date, task_id)
);
create index day_selections_user_date_idx on day_selections(user_id, date);

-- Time tracking: one row per stretch of work, entered as date + clock times
-- so it stays timezone-free. minutes is derived from start/end and stored so
-- totals and exports do not have to re-parse every row.
create table time_logs (
  id text primary key,
  user_id text references team_members(id) on delete cascade,
  project_id text references projects(id) on delete set null,
  task_id text references tasks(id) on delete set null,
  date date not null,
  start_time text not null default '00:00',
  end_time text not null default '00:00',
  minutes integer not null default 0,
  note text not null default '',
  created_at timestamptz not null default now()
);
create index time_logs_user_date_idx on time_logs(user_id, date);
create index time_logs_date_idx on time_logs(date);
create index time_logs_project_idx on time_logs(project_id);

create table activity_log (
  id text primary key,
  task_id text references tasks(id) on delete cascade,
  actor_id text references team_members(id) on delete set null,
  field text not null,
  "from" text,
  "to" text,
  source text not null default 'ui' check (source in ('slack','claude','ui')),
  at timestamptz not null default now()
);
create index activity_task_idx on activity_log(task_id);

create table comments (
  id text primary key,
  task_id text references tasks(id) on delete cascade,
  author_id text references team_members(id) on delete set null,
  body text not null default '',
  created_at timestamptz not null default now()
);
create index comments_task_idx on comments(task_id);

-- Files live in the `attachments` Storage bucket (public); this table holds the
-- metadata. Create the bucket + storage.objects policies separately (dashboard
-- or scripts/attachments-setup) — they aren't part of the public schema here.
create table attachments (
  id text primary key,
  task_id text references tasks(id) on delete cascade,
  author_id text references team_members(id) on delete set null,
  file_name text not null default '',
  file_path text not null,
  file_url text not null default '',
  size bigint not null default 0,
  created_at timestamptz not null default now()
);
create index attachments_task_idx on attachments(task_id);

create table app_settings (
  id integer primary key default 1 check (id = 1),
  slack jsonb not null,
  general jsonb not null
);

-- Row-level security: enabled with permissive prototype policies.
do $$
declare t text;
begin
  foreach t in array array[
    'team_members','clients','projects','tasks','task_dependencies',
    'updates','day_selections','time_logs','activity_log','comments','attachments','app_settings'
  ] loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists %I on %I;', t||'_anon_all', t);
    execute format(
      'create policy %I on %I for all to anon, authenticated using (true) with check (true);',
      t||'_anon_all', t
    );
  end loop;
end $$;

-- Realtime: publish changes so open dashboards sync live.
do $$
declare t text;
begin
  foreach t in array array[
    'team_members','clients','projects','tasks','task_dependencies',
    'updates','day_selections','time_logs','activity_log','comments','attachments','app_settings'
  ] loop
    begin
      execute format('alter publication supabase_realtime add table %I;', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
