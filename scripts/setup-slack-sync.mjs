// Installs database triggers that post to Slack whenever a task is created,
// changed, or deleted, or a comment is added — straight from the DB layer, so
// it fires for every door (web app, Slack, scripts). Posts via pg_net to Slack
// chat.postMessage. The bot token lives in a `private` schema table that is not
// exposed through PostgREST.
//
// Run: node --env-file=.env.local scripts/setup-slack-sync.mjs
import pg from "pg";

const ref = process.env.SUPABASE_PROJECT_REF;
const password = process.env.SUPABASE_DB_PASSWORD;
const token = process.env.SLACK_BOT_TOKEN;
if (!ref || !password) {
  console.error("Missing SUPABASE_PROJECT_REF / SUPABASE_DB_PASSWORD in env.");
  process.exit(1);
}
if (!token) {
  console.error("Missing SLACK_BOT_TOKEN in env.");
  process.exit(1);
}

const client = new pg.Client({
  host: process.env.SUPABASE_DB_HOST || "aws-0-ap-south-1.pooler.supabase.com",
  port: 5432,
  user: `postgres.${ref}`,
  database: "postgres",
  password,
  ssl: { rejectUnauthorized: false },
});

// Mirrors SLACK_EVENTS in lib/types.ts. Every event on = today's behaviour.
const DEFAULT_NOTIFY = {
  created: true,
  updated: true,
  deleted: true,
  reassigned: true,
  comments: true,
  status_backlog: true,
  status_todo: true,
  status_in_progress: true,
  status_blocked: true,
  status_in_review: true,
  status_done: true,
};

const DDL = `
create extension if not exists pg_net;

create schema if not exists private;
revoke all on schema private from anon, authenticated;

create table if not exists private.slack_config (
  id int primary key default 1 check (id = 1),
  bot_token text not null
);
revoke all on private.slack_config from anon, authenticated;

-- Who last touched a task, so a change notice can name them. The app sets
-- it on every write, including just before a delete.
alter table public.tasks
  add column if not exists updated_by text
  references public.team_members(id) on delete set null;

-- Recently posted messages, so the same notice cannot land twice: a retry,
-- a double-click, two windows saving the same edit, or a webhook racing
-- the trigger all collapse into one post.
create table if not exists private.slack_recent (
  digest text primary key,
  at timestamptz not null default now()
);
revoke all on private.slack_recent from anon, authenticated;

-- How long an identical message stays suppressed.
create or replace function private.slack_dedupe_window()
returns interval language sql immutable as $fn$
  select interval '90 seconds'
$fn$;

-- Is this event allowed to reach Slack? Admins own the switches in
-- Settings → Task notifications to Slack, stored as
-- public.app_settings.slack.notify. A missing key means on, so an install that
-- has never touched them behaves exactly as it did before they existed.
create or replace function private.slack_flag(p_notify jsonb, p_key text)
returns boolean language sql immutable as $fn$
  select coalesce((p_notify ->> p_key)::boolean, true)
$fn$;

-- Low-level poster: resolve a channel id/name and fire chat.postMessage.
create or replace function private.slack_post(p_channel text, p_text text)
returns void language plpgsql security definer
set search_path = public, private as $fn$
declare v_token text; v_target text; v_digest text; v_fresh int;
begin
  select bot_token into v_token from private.slack_config where id = 1;
  if v_token is null or p_channel is null or p_text is null then return; end if;
  v_target := case
    when p_channel ~ '^[CGD][A-Z0-9]{6,}$' then p_channel
    else '#' || ltrim(p_channel, '#')
  end;

  -- Same text to the same channel inside the window is a duplicate. The
  -- upsert is the lock: only the statement that actually writes the row
  -- (the first, or the first after the window lapsed) gets to post, so
  -- concurrent writers cannot both slip through.
  v_digest := md5(v_target || '|' || p_text);
  delete from private.slack_recent where at < now() - interval '1 day';
  insert into private.slack_recent as r (digest, at) values (v_digest, now())
    on conflict (digest) do update set at = excluded.at
      where r.at < now() - private.slack_dedupe_window()
  returning 1 into v_fresh;
  if v_fresh is null then return; end if;
  -- Never let a Slack/pg_net hiccup roll back the caller's write.
  begin
    perform net.http_post(
      url := 'https://slack.com/api/chat.postMessage',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_token
      ),
      body := jsonb_build_object('channel', v_target, 'text', p_text, 'unfurl_links', false)
    );
  exception when others then
    null;
  end;
end $fn$;

-- Prefer the project id when it's a Slack channel id (these projects were
-- seeded from Slack, so id == channel id); otherwise fall back to the name.
create or replace function private.slack_channel_for(p_project_id text)
returns text language sql stable security definer
set search_path = public, private as $fn$
  select case
    when p.id ~ '^[CGD][A-Z0-9]{6,}$' then p.id
    when p.slack_channel_id ~ '^[CGD][A-Z0-9]{6,}$' then p.slack_channel_id
    else p.slack_channel_id
  end
  from public.projects p where p.id = p_project_id;
$fn$;

create or replace function private.notify_slack_tasks()
returns trigger language plpgsql security definer
set search_path = public, private as $fn$
declare
  v_channel text; v_text text; v_assignee text; v_changes text[]; v_heading text;
  v_link text; v_actor text; v_notify jsonb;
  st jsonb := '{"backlog":"Backlog","todo":"To do","in_progress":"In progress","blocked":"Blocked","in_review":"In review","done":"Done"}'::jsonb;
begin
  v_channel := private.slack_channel_for(coalesce(NEW.project_id, OLD.project_id));
  if v_channel is null then return coalesce(NEW, OLD); end if;

  -- The admin's switches, read once per row.
  select coalesce(s.slack -> 'notify', '{}'::jsonb) into v_notify
    from public.app_settings s where s.id = 1;

  -- Clickable deep link into the exact task in the app.
  v_link := '  ·  <https://vibe-pm-six.vercel.app/board?task=' ||
            coalesce(NEW.id, OLD.id) || '|open>';

  if TG_OP = 'INSERT' then
    if not private.slack_flag(v_notify, 'created') then return NEW; end if;
    select name into v_assignee from public.team_members where id = NEW.assignee_id;
    select name into v_actor from public.team_members where id = NEW.created_by;
    v_text := ':new: *New task* — *' || NEW.title || '*  ·  ' ||
      coalesce(v_assignee, 'Unassigned') ||
      coalesce('  ·  due ' || NEW.due_date::text, '') ||
      '  ·  ' || coalesce(st->>NEW.status, NEW.status) ||
      '  ·  added by ' || coalesce(v_actor, 'someone') || v_link;
  elsif TG_OP = 'DELETE' then
    if not private.slack_flag(v_notify, 'deleted') then return OLD; end if;
    select name into v_actor from public.team_members where id = OLD.updated_by;
    v_text := ':wastebasket: *Task removed* — ' || OLD.title ||
      '  ·  by ' || coalesce(v_actor, 'someone');
  else
    -- Each kind of change is included only if its switch is on; a change whose
    -- switch is off is left out of the sentence, and an update with nothing
    -- left to say posts nothing at all.
    v_changes := array[]::text[];
    if NEW.status is distinct from OLD.status
       and private.slack_flag(v_notify, 'status_' || NEW.status) then
      v_changes := v_changes || ('status ' || coalesce(st->>OLD.status, OLD.status) ||
                   ' → *' || coalesce(st->>NEW.status, NEW.status) || '*');
    end if;
    if NEW.assignee_id is distinct from OLD.assignee_id
       and private.slack_flag(v_notify, 'reassigned') then
      select name into v_assignee from public.team_members where id = NEW.assignee_id;
      v_changes := v_changes || ('assignee → ' || coalesce(v_assignee, 'Unassigned'));
    end if;
    if NEW.due_date is distinct from OLD.due_date
       and private.slack_flag(v_notify, 'updated') then
      v_changes := v_changes || ('due → ' || coalesce(NEW.due_date::text, 'none'));
    end if;
    if NEW.title is distinct from OLD.title
       and private.slack_flag(v_notify, 'updated') then
      v_changes := v_changes || ('renamed to *' || NEW.title || '*');
      v_heading := OLD.title;   -- so it reads: *old* — renamed to *new*
    end if;
    if NEW.urgency is distinct from OLD.urgency
       and private.slack_flag(v_notify, 'updated') then
      v_changes := v_changes || ('urgency → ' || NEW.urgency);
    end if;
    if array_length(v_changes, 1) is null then return NEW; end if;
    select name into v_actor from public.team_members where id = NEW.updated_by;
    v_text := ':pencil2: *' || coalesce(v_heading, NEW.title) || '* — ' ||
              array_to_string(v_changes, ', ') ||
              '  ·  by ' || coalesce(v_actor, 'someone') || v_link;
  end if;

  perform private.slack_post(v_channel, v_text);
  return coalesce(NEW, OLD);
exception when others then
  return coalesce(NEW, OLD);
end $fn$;

create or replace function private.notify_slack_comments()
returns trigger language plpgsql security definer
set search_path = public, private as $fn$
declare v_channel text; v_title text; v_author text; v_body text; v_text text;
        v_notify jsonb;
begin
  select private.slack_channel_for(t.project_id), t.title
    into v_channel, v_title
    from public.tasks t where t.id = NEW.task_id;
  if v_channel is null then return NEW; end if;
  select coalesce(s.slack -> 'notify', '{}'::jsonb) into v_notify
    from public.app_settings s where s.id = 1;
  if not private.slack_flag(v_notify, 'comments') then return NEW; end if;
  select name into v_author from public.team_members where id = NEW.author_id;
  v_body := coalesce(NEW.body, '');
  if length(v_body) > 280 then v_body := left(v_body, 277) || '…'; end if;
  v_text := ':speech_balloon: *' || coalesce(v_author, 'Someone') ||
    '* commented on <https://vibe-pm-six.vercel.app/board?task=' || NEW.task_id ||
    '|' || coalesce(v_title, 'a task') || '>' ||
    E'\n>' || replace(v_body, E'\n', E'\n>');
  perform private.slack_post(v_channel, v_text);
  return NEW;
exception when others then
  return NEW;
end $fn$;

drop trigger if exists trg_slack_tasks on public.tasks;
create trigger trg_slack_tasks
  after insert or update or delete on public.tasks
  for each row execute function private.notify_slack_tasks();

drop trigger if exists trg_slack_comments on public.comments;
create trigger trg_slack_comments
  after insert on public.comments
  for each row execute function private.notify_slack_comments();
`;

async function main() {
  await client.connect();
  console.log("Connected. Installing Slack-sync triggers…");
  await client.query(DDL);
  await client.query(
    `insert into private.slack_config (id, bot_token) values (1, $1)
     on conflict (id) do update set bot_token = excluded.bot_token`,
    [token]
  );
  // Seed the notification switches the first time only — all on, so installing
  // them changes nothing until an admin turns something off in Settings.
  const seeded = await client.query(
    `update app_settings
        set slack = jsonb_set(slack, '{notify}', $1::jsonb, true)
      where id = 1 and not (slack ? 'notify')`,
    [JSON.stringify(DEFAULT_NOTIFY)]
  );
  console.log(
    seeded.rowCount
      ? "Notification switches seeded (all on)."
      : "Notification switches already set — left alone."
  );
  const { rows } = await client.query(
    `select tgname, relname from pg_trigger t
       join pg_class c on c.oid = t.tgrelid
      where tgname in ('trg_slack_tasks','trg_slack_comments')`
  );
  console.log("Triggers installed:", rows.map((r) => `${r.tgname} on ${r.relname}`));
  const net = await client.query(
    `select count(*) from pg_extension where extname = 'pg_net'`
  );
  console.log("pg_net enabled:", Number(net.rows[0].count) === 1);
  await client.end();
  console.log("Done.");
}

main().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
