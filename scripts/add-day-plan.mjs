// Additive migration for the "My Day" plan feature — creates day_selections
// and merges min_daily_points into the existing app_settings row, WITHOUT
// touching (let alone dropping) any other table. Safe to re-run.
// Run: node --env-file=.env.local scripts/add-day-plan.mjs
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
    create table if not exists day_selections (
      id text primary key,
      user_id text references team_members(id) on delete cascade,
      date date not null,
      task_id text references tasks(id) on delete cascade,
      created_at timestamptz not null default now(),
      unique (user_id, date, task_id)
    );
    create index if not exists day_selections_user_date_idx on day_selections(user_id, date);

    alter table day_selections enable row level security;
    drop policy if exists day_selections_anon_all on day_selections;
    create policy day_selections_anon_all on day_selections
      for all to anon, authenticated using (true) with check (true);
  `);
  console.log("  day_selections: table + RLS ready");

  try {
    await client.query(
      `alter publication supabase_realtime add table day_selections;`
    );
    console.log("  day_selections: added to realtime publication");
  } catch (e) {
    if (e.code === "42710") {
      console.log("  day_selections: already in realtime publication");
    } else {
      throw e;
    }
  }

  await client.query(`
    update app_settings
    set general = general || '{"min_daily_points": 3}'::jsonb
    where id = 1 and not (general ? 'min_daily_points');
  `);
  console.log("  app_settings: min_daily_points merged in (if missing)");

  await client.end();
  console.log("Done.");
}

main().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
