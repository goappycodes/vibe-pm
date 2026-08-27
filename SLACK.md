# Slack outbound (board → Slack)

Every change to a task posts a compact summary to that task's **project Slack
channel**. It runs at the database layer via a Supabase **Database Webhook**, so
it fires for changes from any door — the dashboard, Claude, or Slack itself.

- **Route:** `POST /api/slack/task-change` ([app/api/slack/task-change/route.ts](app/api/slack/task-change/route.ts))
- Parses the webhook payload, looks up the project's `slack_channel_id` and the
  member names, composes a message, and calls Slack `chat.postMessage`.
- **Dry-run:** with no `SLACK_BOT_TOKEN` it logs the message instead of posting
  (so you can test the pipeline without a bot). Verified locally:
  - INSERT → `:new: *New task* — *<title>* · <assignee> · due <date> · <status>`
  - UPDATE → `:pencil2: *<title>* — status X → *Y*, assignee → …, due → …`
  - DELETE → `:wastebasket: *Task removed* — <title>`

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
- A future step (inbound) parses Slack daily updates back into task changes —
  not built yet.
