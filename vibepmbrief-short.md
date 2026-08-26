# Vibe PM — Brief (v0.2)

_A fast, AI-native project manager for Appycodes. Next.js + Supabase, wired to Slack, driven by Claude._

---

## 1. The problem

Tasks are born in conversation, but opening a PM tool to log them is an extra step that gets skipped. Updates then live in Slack, status lives in people's heads, and the board drifts stale — so no one trusts it, so no one updates it. The fix: make the board **as fast as talking**, let Claude **write to it directly**, and make it **listen to Slack** where work is already discussed. Keeping it current should cost nothing.

## 2. Principles

1. **Fast beats featureful** — sub-second, keyboard-first, inline + bulk edits.
2. **One source of truth** — dashboard, Claude, and Slack all resolve to the same database under the same rules.
3. **Slack-native, both ways** — every change echoes to Slack; every update dropped in Slack flows back onto tasks. No double entry.
4. **AI as operator** — say what you finished, the board updates.

## 3. Architecture

```
  Dashboard ───┐                          ┌──► Realtime → live dashboards
  (Next.js UI) ├──► Next.js on Vercel ────┤
  Slack ───────┘     API · Slack handlers │
                                ┌─────────▼──────────┐
  Claude ──────────────────────►  Supabase Postgres  │──► Slack (on change → notify)
  (direct Supabase)             │  truth · Auth · RLS │
                                │  Realtime · triggers│◄── Slack update → parse → back in
                                └─────────────────────┘
```

- Everything reads/writes **one Postgres database** in Supabase.
- Dashboard and Slack go through the Next.js app layer; **Claude connects to Supabase directly**.
- On any write: **Realtime** pushes to open dashboards and a **DB trigger/webhook** notifies Slack.
- Because Claude writes straight to the DB, the **Slack echo and audit log are enforced by database triggers**, not app code — so they fire no matter which door the write came from.

## 4. Data model

`tasks` is the center of gravity; everything else describes a task or records what happened to it.

| Table | Key fields |
|---|---|
| **tasks** | id, project_id, title, description, assignee_id, due_date, eta_hours, status, urgency, order, created_by, completed_at, created_at, updated_at |
| **team_members** | id, name, email, avatar, role, slack_user_id, timezone |
| **projects** | id, name, owner_id, status, color, slack_channel_id, target_date |
| **task_dependencies** | task_id, depends_on_task_id, type |
| **updates** | id, author_id, source (slack / claude / ui), raw_text, parsed, created_at |
| **activity_log** | id, task_id, actor_id, field, from → to, at _(append-only audit)_ |
| **project_members** | project_id, user_id, role |
| **comments / attachments** | id, task_id, author_id, body / file_url |

**Enums**
- `status`: backlog · todo · in_progress · blocked · in_review · done
- `urgency`: low · medium · high · urgent

## 5. Surfaces

Same data, four lenses — all editable in place, no modals.

- **My Day** _(default)_ — your tasks, sorted by urgency and due date.
- **Table** — dense grid: inline edit, multi-select, bulk reassign / restatus / reschedule.
- **Board** — kanban by status, per project. Fastest for a standup sweep.
- **Timeline** — due dates + dependencies on one axis; see what blocks what and where a slip cascades.

**Feels instant via:** optimistic updates · realtime sync · command palette (⌘K) · multi-select bulk edit · inline editing · keyboard shortcuts.

## 6. AI layer — direct Supabase

Claude connects **directly to Supabase** (Supabase's official connector) — no custom MCP server in v1. It reads and writes the board through normal Postgres access, scoped to the acting user's permissions.

- Writes go straight to the database, so **RLS, DB triggers (Slack echo + activity log), and auto-reschedule logic all live in Postgres** and apply uniformly.
- **Gated to admins / team leads**, behind a confirmation step for bulk operations, so large seeds and mass edits don't happen silently.

## 7. Slack integration

Workspace **appycodes.slack.com**, **one channel per project**.

**Outbound — board → Slack:** a task changes (any door) → DB webhook fires → app posts a compact update to the project channel. Optional daily standup digest per project.

**Inbound — Slack → board:** someone drops a daily update (or `/update`) → signature-verified Events API route → Claude parses free text into task changes (done / in-progress / blocked / ETA) → applied to the DB → ✓ reaction confirms.

## 8. Access & safety

- **~30 people**, three roles: **admin · team lead · team member**.
- **Auth** — Supabase **email magic links** (no passwords).
- **RLS is the backbone** — the same rules for the dashboard, Slack, and Claude.
- **Direct Supabase is gated** — Claude acts under a per-user scoped role, never superuser; bulk ops need confirmation.
- **Slack verified** — every inbound request is signature-checked.
- **Everything logged** — append-only activity log records every change, whichever door it came through.

## 9. Dependencies

A **slipped task auto-reschedules its dependents** — pushing a due date cascades forward along the dependency chain (enforced by DB logic so it holds for every write path).

## 10. Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js (App Router) on Vercel | One deploy hosts UI, API, and Slack handlers. |
| Database & auth | Supabase — Postgres, Auth, Realtime, Storage | RLS, realtime, webhooks, triggers, storage in one backend. |
| UI | Tailwind + shadcn/ui | Fast, clean, keyboard-accessible primitives. |
| Grid / board | TanStack Table + dnd-kit | Spreadsheet-grade inline editing, smooth drag-and-drop. |
| Data / state | TanStack Query + Supabase Realtime | Optimistic updates with live sync across teammates. |
| AI | Claude via direct Supabase connector | Reads/writes the board directly; DB triggers enforce echo + audit. |
| Slack | Slack Web API + Events API | Outbound posts and inbound capture, signature-verified. |

---

_Brief v0.2 — a starting point to define further, not a final spec._
