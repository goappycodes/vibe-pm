# Supabase setup

The app is wired to Supabase for persistence + realtime, with a **bundled-JSON fallback** so it still runs if Supabase isn't configured.

## How it works (fast by design)

1. **Instant render** from bundled `data/*.json` — no loading spinner.
2. **Hydrate**: on mount the store fetches all tables from Supabase in parallel and reconciles.
3. **Optimistic writes**: every edit updates in-memory immediately, then persists to Supabase in the background (`lib/supabase/persist.ts`).
4. **Realtime**: the store subscribes to `postgres_changes` and merges remote edits live (echoes of our own writes are ignored for ~2.5s).
5. **Fallback**: if `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` are unset or a fetch fails, it stays on bundled data.

## Environment

Copy `.env.example` → `.env.local` and fill in. Only `NEXT_PUBLIC_*` reach the browser (safe — protected by RLS).

| Var | Where | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client | public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client | public (anon, RLS-guarded) |
| `SUPABASE_SERVICE_ROLE_KEY` | scripts only | **secret — never commit / never expose to the browser** |
| `SUPABASE_DB_PASSWORD` | scripts only | **secret** |
| `SUPABASE_PROJECT_REF` | scripts only | project ref |

## Create schema + seed

```bash
npm run db:setup
```

Applies `supabase/schema.sql` (tables, indexes, permissive RLS policies, realtime publication) and seeds from `data/*.json` via the ap-south-1 pooler. You can also paste `supabase/schema.sql` into the Supabase SQL editor.

## Additive migrations

`schema.sql` **drops and recreates** every table, so never run `db:setup`
against a database with real data. Feature migrations are additive and safe to
re-run:

```bash
npm run db:time-logs   # creates time_logs (+ indexes, RLS, realtime)
```

## Deploying to Vercel

Add these to the Vercel project's Environment Variables, then redeploy:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

(No secret keys in Vercel for the client app.) Until they're set, the deployed app runs on bundled JSON.

## Security notes

- RLS is **enabled** but with **permissive prototype policies** (`using (true)`) so the anon key can read/write without login. Tighten these once magic-link auth is added — scope policies to `auth.uid()` and roles.
- The `service_role` key and DB password are admin-level. Keep them only in `.env.local` (gitignored). Rotate immediately if they were ever shared in plaintext.
