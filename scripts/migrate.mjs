// Idempotent, NON-destructive migrations. Safe to run repeatedly. Never drops.
// Add new statements to the MIGRATIONS array as the schema evolves.
// Run: node --env-file=.env.local scripts/migrate.mjs
import pg from "pg";

const ref = process.env.SUPABASE_PROJECT_REF;
const password = process.env.SUPABASE_DB_PASSWORD;
if (!ref || !password) {
  console.error("Missing SUPABASE_PROJECT_REF / SUPABASE_DB_PASSWORD.");
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

const MIGRATIONS = [
  // --- Time tracking (Clockify-style logging against a task) ---
  `create table if not exists time_logs (
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
   )`,
  `create index if not exists time_logs_user_date_idx on time_logs(user_id, date)`,
  `create index if not exists time_logs_date_idx on time_logs(date)`,
  `create index if not exists time_logs_project_idx on time_logs(project_id)`,

  // --- Projects can link to a git repo ---
  `alter table projects add column if not exists git_repo_url text`,

  // --- RLS (permissive prototype policy) for time_logs ---
  `alter table time_logs enable row level security`,
  `drop policy if exists time_logs_anon_all on time_logs`,
  `create policy time_logs_anon_all on time_logs for all to anon, authenticated using (true) with check (true)`,
];

// Realtime publication adds must tolerate "already added".
const REALTIME_TABLES = ["time_logs"];

async function main() {
  await client.connect();
  console.log("Connected. Running idempotent migrations…");
  for (const sql of MIGRATIONS) {
    await client.query(sql);
    console.log("  ok:", sql.split("\n")[0].slice(0, 70).trim());
  }
  for (const t of REALTIME_TABLES) {
    await client.query(
      `do $$ begin
         begin execute format('alter publication supabase_realtime add table %I;', $tbl$${t}$tbl$);
         exception when duplicate_object then null; end;
       end $$;`
    );
    console.log(`  ok: realtime ${t}`);
  }
  // Sanity: confirm the key objects exist.
  const chk = await client.query(
    `select
       (select count(*) from information_schema.tables where table_name='time_logs') as time_logs,
       (select count(*) from information_schema.columns where table_name='projects' and column_name='git_repo_url') as git_col`
  );
  console.log("Verify:", chk.rows[0]);
  await client.end();
  console.log("Done.");
}

main().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
