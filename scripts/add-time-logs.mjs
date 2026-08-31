// Additive migration for the Time Log feature — creates time_logs WITHOUT
// touching (let alone dropping) any other table. Safe to re-run.
// Run: node --env-file=.env.local scripts/add-time-logs.mjs
import pg from "pg";

const ref = process.env.SUPABASE_PROJECT_REF;
const password = process.env.SUPABASE_DB_PASSWORD;
if (!ref || !password) {
  console.error("Missing SUPABASE_PROJECT_REF / SUPABASE_DB_PASSWORD in env.");
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

async function main() {
  await client.connect();
  console.log("Connected. Applying additive migration…");

  await client.query(`
    create table if not exists time_logs (
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
    create index if not exists time_logs_user_date_idx on time_logs(user_id, date);
    create index if not exists time_logs_date_idx on time_logs(date);
    create index if not exists time_logs_project_idx on time_logs(project_id);

    alter table time_logs enable row level security;
    drop policy if exists time_logs_anon_all on time_logs;
    create policy time_logs_anon_all on time_logs
      for all to anon, authenticated using (true) with check (true);
  `);
  console.log("  time_logs: table + indexes + RLS ready");

  try {
    await client.query(
      `alter publication supabase_realtime add table time_logs;`
    );
    console.log("  time_logs: added to realtime publication");
  } catch (e) {
    if (e.code === "42710") {
      console.log("  time_logs: already in realtime publication");
    } else {
      throw e;
    }
  }

  await client.end();
  console.log("Done.");
}

main().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
