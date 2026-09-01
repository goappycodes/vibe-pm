// Applies a single .sql migration file to the live Supabase database over the
// IPv4 pooler (direct db.<ref> is IPv6-only and doesn't resolve here).
//
// Unlike scripts/db-setup.mjs, this does NOT drop or reseed anything — it just
// runs the given file, so it's safe against the real data.
//
// Run: node --env-file=.env.local scripts/apply-migration.mjs supabase/migrations/0001_breaks.sql
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, isAbsolute } from "node:path";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const rel = process.argv[2];
if (!rel) {
  console.error("Usage: apply-migration.mjs <path-to-.sql>");
  process.exit(1);
}
const file = isAbsolute(rel) ? rel : join(root, rel);

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
  const sql = readFileSync(file, "utf8");
  await client.connect();
  console.log(`Connected. Applying ${rel}…`);
  await client.query(sql);
  console.log("Migration applied.");
  await client.end();
  console.log("Done.");
}

main().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
