// Applies supabase/schema.sql and seeds from data/*.json.
// Run: node --env-file=.env.local scripts/db-setup.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const read = (p) => JSON.parse(readFileSync(join(root, "data", p), "utf8"));

const ref = process.env.SUPABASE_PROJECT_REF;
const password = process.env.SUPABASE_DB_PASSWORD;
if (!ref || !password) {
  console.error("Missing SUPABASE_PROJECT_REF / SUPABASE_DB_PASSWORD in env.");
  process.exit(1);
}

const client = new pg.Client({
  host:
    process.env.SUPABASE_DB_HOST || "aws-0-ap-south-1.pooler.supabase.com",
  port: 5432,
  user: `postgres.${ref}`,
  database: "postgres",
  password,
  ssl: { rejectUnauthorized: false },
});

const q = (col) => `"${col}"`;

async function upsert(table, cols, rows, pk) {
  if (rows.length === 0) return;
  for (const row of rows) {
    const vals = cols.map((c) => row[c] ?? null);
    const ph = cols.map((_, i) => `$${i + 1}`).join(", ");
    const updates = cols
      .filter((c) => !pk.includes(c))
      .map((c) => `${q(c)} = excluded.${q(c)}`)
      .join(", ");
    const sql =
      `insert into ${table} (${cols.map(q).join(", ")}) values (${ph}) ` +
      `on conflict (${pk.map(q).join(", ")}) do update set ${updates}`;
    await client.query(sql, vals);
  }
  console.log(`  ${table}: ${rows.length} rows`);
}

async function main() {
  await client.connect();
  console.log("Connected. Applying schema…");
  await client.query(readFileSync(join(root, "supabase", "schema.sql"), "utf8"));
  console.log("Schema applied. Seeding…");

  await upsert(
    "team_members",
    ["id", "name", "email", "avatar", "role", "lead_id", "slack_user_id", "timezone"],
    read("team_members.json"),
    ["id"]
  );
  await upsert(
    "clients",
    ["id", "name", "contact_name", "contact_email", "status", "color", "created_at"],
    read("clients.json"),
    ["id"]
  );
  await upsert(
    "projects",
    ["id", "name", "owner_id", "client_id", "status", "color", "slack_channel_id", "target_date"],
    read("projects.json"),
    ["id"]
  );
  await upsert(
    "tasks",
    ["id", "project_id", "title", "description", "assignee_id", "due_date", "story_points",
     "status", "urgency", "order", "created_by", "completed_at", "created_at", "updated_at"],
    read("tasks.json"),
    ["id"]
  );
  await upsert(
    "task_dependencies",
    ["task_id", "depends_on_task_id", "type"],
    read("task_dependencies.json"),
    ["task_id", "depends_on_task_id"]
  );
  await upsert(
    "updates",
    ["id", "author_id", "source", "raw_text", "parsed", "task_id", "created_at"],
    read("updates.json"),
    ["id"]
  );
  await upsert(
    "activity_log",
    ["id", "task_id", "actor_id", "field", "from", "to", "source", "at"],
    read("activity_log.json"),
    ["id"]
  );

  const settings = read("settings.json");
  await client.query(
    `insert into app_settings (id, slack, general) values (1, $1::jsonb, $2::jsonb)
     on conflict (id) do update set slack = excluded.slack, general = excluded.general`,
    [JSON.stringify(settings.slack), JSON.stringify(settings.general)]
  );
  console.log("  app_settings: 1 row");

  const counts = await client.query(
    `select 'tasks' t, count(*) from tasks union all
     select 'projects', count(*) from projects union all
     select 'members', count(*) from team_members union all
     select 'clients', count(*) from clients`
  );
  console.log("Row counts:", Object.fromEntries(counts.rows.map((r) => [r.t, Number(r.count)])));
  await client.end();
  console.log("Done.");
}

main().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
