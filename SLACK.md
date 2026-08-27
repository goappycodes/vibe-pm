# Slack outbound (board → Slack)

## Live sync — database triggers (active)

Every task **create / change / delete** and every **comment** posts to that
project's Slack channel, straight from the **database layer** via Postgres
triggers + `pg_net`. Because it runs in the DB it fires for every door — the web
app, Slack, or a script — with no app server, Vercel, or webhook involved.

- **Install / update:** `node --env-file=.env.local scripts/setup-slack-sync.mjs`
  ([scripts/setup-slack-sync.mjs](scripts/setup-slack-sync.mjs)) — idempotent.
- **Token storage:** the bot token lives in `private.slack_config` (a schema not
  exposed through PostgREST), read only by the `security definer` trigger
  functions. Re-run the script after rotating the token.
- **Channel:** uses `projects.id` when it's a Slack channel id (these projects
  were seeded from Slack, so id == channel id), else `#<slack_channel_id>`. The
  bot has `chat:write.public`, so it posts to any **public** channel without an
  invite (private channels need `/invite @vibe_pm`).
- **Safety:** trigger functions swallow any Slack/pg_net error, so a Slack
  outage can never roll back a task or comment write. `order`-only updates (drag
  reordering) don't post — only status/assignee/due/title/urgency changes do.
- Verified end to end (INSERT/UPDATE/COMMENT/DELETE → HTTP 200, `ok:true`):
  - INSERT → `:new: *New task* — *<title>* · <assignee> · due <date> · <status>`
  - UPDATE → `:pencil2: *<title>* — status X → *Y*, assignee → …`
  - COMMENT → `:speech_balloon: *<author>* commented on *<title>* > <body>`
  - DELETE → `:wastebasket: *Task removed* — <title>`
- **Turn off:** `drop trigger trg_slack_tasks on tasks;` and
  `drop trigger trg_slack_comments on comments;`

## Alternative — Supabase Database Webhook → route (dormant)

The same behaviour is also implemented as an app route for teams who prefer a
Supabase **Database Webhook** over in-DB triggers. It is **not wired** (no
webhook configured) — if you enable it, disable the triggers above to avoid
double-posting.

- **Route:** `POST /api/slack/task-change` ([app/api/slack/task-change/route.ts](app/api/slack/task-change/route.ts))
- Parses the webhook payload, looks up the project's `slack_channel_id` and the
  member names, composes a message, and calls Slack `chat.postMessage`.
- **Dry-run:** with no `SLACK_BOT_TOKEN` it logs the message instead of posting.

## Daily standup (My Day plan → Slack)

A member picks their tasks for the day on **My Day**, then hits **Post to Slack**
to send the plan as a daily standup to the team's **standup channel**. The same
posting also happens from the **/updates** composer's *Post update* button. Each
post is mirrored into the in-app updates feed (tagged **Slack** when it actually
reached Slack, **Dashboard** on a dry-run).

- **Route:** `POST /api/slack/standup` ([app/api/slack/standup/route.ts](app/api/slack/standup/route.ts))
- Body: `{ text, channel? }`. The composed message groups the picked tasks by
  Completed / Planned / Blockers with a story-point tally.
- **Channel resolution:** `SLACK_STANDUP_CHANNEL` (env) → the client's hint (the
  workspace channel named `standups`) → `#standups`. Set the env to a channel
  **ID** the bot is in for reliable delivery.
- **Dry-run:** with no `SLACK_BOT_TOKEN` it logs the standup instead of posting.
  Verified locally (`{"ok":false,"dryRun":true,"channel":"#standups"}`).

## Setup (one-time)

### 1. Slack app + bot token
1. Create an app at https://api.slack.com/apps → **From scratch**, pick the
   Appycodes workspace.
2. **OAuth & Permissions** → Bot Token Scopes → add **`chat:write`** (and
   `chat:write.public` if you want to post to channels the bot hasn't joined).
3. **Install to Workspace** → copy the **Bot User OAuth Token** (`xoxb-…`).
4. Invite the bot to each project channel: `/invite @YourBotName` (or rely on
   `chat:write.public`).

### 2. Environment variables (Vercel → Settings → Environment Variables)
- `SLACK_BOT_TOKEN` = the `xoxb-…` token (secret)
- `SLACK_STANDUP_CHANNEL` = the standup channel **ID** (e.g. `C0…`) the bot is in
  (optional — falls back to `#standups`)
- `SUPABASE_WEBHOOK_SECRET` = a long random string (secret)
- `SUPABASE_SERVICE_ROLE_KEY` = your service-role key (secret — used server-side
  only to look up the channel/member names)
- `NEXT_PUBLIC_SUPABASE_URL` = your project URL

### 3. Supabase Database Webhook
Database → **Webhooks** → Create:
- **Table:** `tasks` · **Events:** Insert, Update, Delete
- **Type:** HTTP Request → `POST`
- **URL:** `https://<your-app>/api/slack/task-change`
- **HTTP Headers:** add `x-webhook-secret: <same value as SUPABASE_WEBHOOK_SECRET>`

That's it — edit a task and the project channel gets a note.

## Notes
- `projects.slack_channel_id` stores the **channel name** (e.g. `salpido`); the
  route sends to `#salpido`. Using channel **IDs** (`C0…`) is more robust — the
  route passes those through as-is. Make sure the bot is a member of the channel.
- Slack's default sender obeys workspace rate limits; heavy edit bursts may be
  throttled. Batch/debounce later if needed.
## Inbound — create tasks from Slack

Two ways to turn Slack into a task, both landing in the project mapped to the
channel (these projects were seeded from Slack, so `project.id` == channel id).
The invoking Slack user is matched to a member by `slack_user_id` and set as the
assignee; the reply is ephemeral, and the DB trigger posts the shared `:new:`
note to the channel.

- **Slash command** `/vibe <title>` — add `!high` / `!urgent` to flag priority.
  Route: `POST /api/slack/command` ([app/api/slack/command/route.ts](app/api/slack/command/route.ts)).
- **Message shortcut** "Add to Vibe PM" — turns any message into a task (title =
  first line, description = the full message + who posted it).
  Route: `POST /api/slack/interactivity` ([app/api/slack/interactivity/route.ts](app/api/slack/interactivity/route.ts)).

Verified locally end to end: a valid request creates the task with the right
project / assignee / urgency.

### Runtime — pick one

**A. Socket Mode (no public URL) — worker** ([scripts/slack-socket.mjs](scripts/slack-socket.mjs)) — *active*

Keeps a WebSocket open to Slack, so nothing is exposed publicly. It's a
long-running process — run it on an **always-on host** (a small VM,
Railway/Render/Fly, or any box that stays up). It **cannot** run on Vercel
serverless, which can't hold a socket open.

- Run: `node --env-file=.env.local scripts/slack-socket.mjs`
- Env: `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN` (`xapp-…`, scope `connections:write`),
  `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- Slack app (https://api.slack.com/apps → your app):
  - **Socket Mode → On**.
  - **Basic Information → App-Level Tokens → Generate** a token with
    `connections:write` — that's `SLACK_APP_TOKEN`.
  - **Slash Commands → Create New Command** `/vibe` (no Request URL needed).
  - **Interactivity & Shortcuts → On** → **Create New Shortcut → On messages**,
    name "Add to Vibe PM", callback id `vibe_add_task`.
  - **OAuth & Permissions → Bot Token Scopes** → add `commands`. **Reinstall**.

**B. HTTP routes (public Request URL) — alternative**

`POST /api/slack/command` + `POST /api/slack/interactivity` on the deployed app.
Needs `SLACK_SIGNING_SECRET` (+ `SUPABASE_SERVICE_ROLE_KEY`,
`NEXT_PUBLIC_SUPABASE_URL`, `SLACK_BOT_TOKEN`) set in Vercel and the feature
Request URLs pointed at those routes. Requests are signature-verified
(bad/stale → 401). Use this only if you turn Socket Mode **off**.

Either way, the command/shortcut only works in a channel that maps to a project.
