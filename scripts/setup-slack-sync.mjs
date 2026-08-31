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

const DDL = `
create extension if not exists pg_net;

create schema if not exists private;
revoke all on schema private from anon, authenticated;

create table if not exists private.slack_config (
  id int primary key default 1 check (id = 1),
  bot_token text not null
);
revoke all on private.slack_config from anon, authenticated;

-- Low-level poster: resolve a channel id/name and fire chat.postMessage.
create or replace function private.slack_post(p_channel text, p_text text)
returns void language plpgsql security definer
set search_path = public, private as $fn$
declare v_token text; v_target text;
begin
  select bot_token into v_token from private.slack_config where id = 1;
  if v_token is null or p_channel is null or p_text is null then return; end if;
  v_target := case
    when p_channel ~ '^[CGD][A-Z0-9]{6,}$' then p_channel
    else '#' || ltrim(p_channel, '#')
  end;
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
  st jsonb := '{"backlog":"Backlog","todo":"To do","in_progress":"In progress","blocked":"Blocked","in_review":"In review","done":"Done"}'::jsonb;
begin
  v_channel := private.slack_channel_for(coalesce(NEW.project_id, OLD.project_id));
  if v_channel is null then return coalesce(NEW, OLD); end if;

  if TG_OP = 'INSERT' then
    select name into v_assignee from public.team_members where id = NEW.assignee_id;
    v_text := ':new: *New task* — *' || NEW.title || '*  ·  ' ||
      coalesce(v_assignee, 'Unassigned') ||
      coalesce('  ·  due ' || NEW.due_date::text, '') ||
      '  ·  ' || coalesce(st->>NEW.status, NEW.status);
  elsif TG_OP = 'DELETE' then
    v_text := ':wastebasket: *Task removed* — ' || OLD.title;
  else
    v_changes := array[]::text[];
    if NEW.status is distinct from OLD.status then
      v_changes := v_changes || ('status ' || coalesce(st->>OLD.status, OLD.status) ||
                   ' → *' || coalesce(st->>NEW.status, NEW.status) || '*');
    end if;
    if NEW.assignee_id is distinct from OLD.assignee_id then
      select name into v_assignee from public.team_members where id = NEW.assignee_id;
      v_changes := v_changes || ('assignee → ' || coalesce(v_assignee, 'Unassigned'));
    end if;
    if NEW.due_date is distinct from OLD.due_date then
      v_changes := v_changes || ('due → ' || coalesce(NEW.due_date::text, 'none'));
    end if;
    if NEW.title is distinct from OLD.title then
      v_changes := v_changes || ('renamed to *' || NEW.title || '*');
      v_heading := OLD.title;   -- so it reads: *old* — renamed to *new*
    end if;
    if NEW.urgency is distinct from OLD.urgency then
      v_changes := v_changes || ('urgency → ' || NEW.urgency);
    end if;
    if array_length(v_changes, 1) is null then return NEW; end if;
    v_text := ':pencil2: *' || coalesce(v_heading, NEW.title) || '* — ' ||
              array_to_string(v_changes, ', ');
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
begin
  select private.slack_channel_for(t.project_id), t.title
    into v_channel, v_title
    from public.tasks t where t.id = NEW.task_id;
  if v_channel is null then return NEW; end if;
  select name into v_author from public.team_members where id = NEW.author_id;
  v_body := coalesce(NEW.body, '');
  if length(v_body) > 280 then v_body := left(v_body, 277) || '…'; end if;
  v_text := ':speech_balloon: *' || coalesce(v_author, 'Someone') ||
    '* commented on *' || coalesce(v_title, 'a task') || '*' ||
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
