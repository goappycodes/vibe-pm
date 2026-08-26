# Vibe PM — Technical Brief (v0.1)

_A fast, AI-native project management system for Apicode. Built on Next.js + Supabase, wired to Slack, exposed over MCP._

---

## 1. The problem

Tasks are born in conversation — a hallway chat, a Slack message, "can you also handle this." Opening the PM tool to enter them is an extra step that quietly gets skipped. Daily updates then live in Slack, status lives in people's heads, and the board drifts out of date. Once it's stale, no one trusts it, so no one updates it. The loop feeds itself.

**The fix isn't more fields or more discipline.** It's to:
- make the board **as fast as talking**,
- let you **talk to it directly** through Claude (MCP), and
- make it **listen to where you already talk** (Slack),

so keeping it current costs nothing.

---

## 2. Principles

1. **Fast beats featureful** — sub-second interactions, keyboard-first, inline + bulk edits. If an update takes more than a couple of keystrokes, people won't do it.
2. **Two doors, one truth** — the dashboard and Claude write to the same database under the same rules, always in sync.
3. **Slack-native, both ways** — every change echoes out to Slack; every daily update dropped in Slack (or to Claude) flows back onto the tasks. No double entry.
4. **AI as an operator** — drop a plan, get a project; say what you finished, the board updates.

---

## 3. Architecture

Two write-doors → one source of truth, fanning out to Slack and back.

```
  Dashboard ─────┐                                  ┌──► Realtime → live dashboards
  (Next.js UI)   │                                  │
                 ├──►  Next.js on Vercel   ──────────┤
  Claude ────────┘      API · MCP host ·             │
  (via MCP)             Slack handlers ·    ┌────────▼─────────────┐
                        ingestion           │  Supabase — Postgres │──► Slack  (on change → notify)
                             ▲              │  single source of     │      ▲
                             │              │  truth · Auth · RLS ·  │      │
                             │              │  Realtime · Storage    │      │
                    drop plan│              └────────────────────────┘      │
                  Excel/plan ┘         Slack update / dropped plan → parse → back in
```

- Everything reads and writes **one Postgres database** in Supabase.
- The dashboard and Claude are just two front doors onto it; **Row-Level Security enforces the same rules for both**.
- When data changes: **Realtime** pushes it live to open dashboards, and a **DB webhook** notifies Slack.
- Updates dropped in Slack — or a plan dropped into Claude — flow **back in** through the same app layer.

---

## 4. Data model

`tasks` is the center of gravity. Everything else describes a task or records what happened to it. Kept lean so both the UI and Claude can reason about it without ceremony.

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

---

## 5. The surfaces (dashboard UX)

Same data, four lenses — all editable in place, nothing needs a modal.

- **My Day** _(default)_ — just your tasks, sorted by urgency and due date.
- **Table** — dense spreadsheet grid: inline edit, multi-select, bulk changes (reassign / restatus / reschedule many at once).
- **Board** — kanban by status, per project. Fastest for a standup sweep.
- **Timeline** — due dates + dependencies on one axis; see what blocks what and where a slip cascades.

**What makes it feel instant:** optimistic updates · realtime sync · command palette (⌘K) · multi-select bulk edit · inline editing · keyboard shortcuts for status / assignee / date.

---

## 6. The AI layer (MCP) — the "vibe" part

Claude connects over MCP. Two paths, deliberately different:

### Custom MCP server — everyday, **recommended**
Hosted inside the Next.js app. Every write goes through business logic: validation, permission checks (RLS as the user), activity logging, and the Slack echo. Safe by construction — Claude can't corrupt state or skip a notification.

Example tools:

| Tool | What it does |
|---|---|
| `create_task` | Add a task with assignee, due date, ETA, urgency, dependencies — in one call. |
| `update_task` | Change any field; validated, logged, fires the Slack echo. |
| `bulk_update_tasks` | "Move everything due this week to next Monday" — filter + patch many. |
| `query_tasks` | Read the board by project, assignee, status, urgency, or due window. |
| `log_update` | "Finished the API, blocked on design" → parses and applies to your tasks. |
| `import_plan` | Turn a parsed Excel/plan into a reviewable set of tasks + deps + dates. |
| `add_dependency` | Wire "A blocks B" so timeline and blocked-status stay honest. |

### Direct Supabase — power tool, **gated**
Official Supabase MCP for large one-off seeding and raw queries. Fast, but bypasses app logic (no Slack echo / audit unless DB triggers cover it). Restricted to owner/admin, behind a confirmation step, so bulk imports don't quietly go dark.

---

## 7. Slack integration

Each project maps to a Slack channel.

**Outbound — board → Slack**
1. A task changes (any door: UI, Claude, or Slack itself).
2. A Supabase DB webhook fires on the write.
3. The app posts a compact update to the project channel (`chat.postMessage`).
4. Optional daily digest: a morning standup summary per project.

**Inbound — Slack → board**
1. Someone drops a daily update in the channel (or via a `/update` command).
2. Slack's Events API hits a Next.js route (signature-verified).
3. Claude parses free text into task changes — done, in-progress, blocked, ETA.
4. Changes apply through the same MCP logic; a ✓ reaction confirms.

---

## 8. Access & safety

- **Auth per person** — Supabase Auth; Google Workspace SSO recommended (one click, no new password).
- **RLS is the backbone** — the same rules for the dashboard and for Claude.
- **MCP acts as you** — Claude connects with a per-user scoped token and operates under that user's permissions, never as a superuser.
- **Service role, gated** — the admin key is used only for confirmed bulk seeding.
- **Slack verified** — every inbound Slack request is signature-checked.
- **Everything logged** — append-only activity log records every change, whichever door it came through.

---

## 9. Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js (App Router) on Vercel | One deploy hosts UI, API, the MCP endpoint, and Slack handlers. |
| Database & auth | Supabase — Postgres, Auth, Realtime, Storage | RLS, realtime, webhooks, file storage in one managed backend. |
| UI | Tailwind + shadcn/ui | Fast, clean, keyboard-accessible primitives. |
| Grid / board | TanStack Table + dnd-kit | Spreadsheet-grade inline editing and smooth drag-and-drop. |
| Data / state | TanStack Query + Supabase Realtime | Optimistic updates with live sync across teammates. |
| AI | MCP TypeScript SDK + Claude | Typed tools for safe writes; Anthropic API for parsing plans & updates. |
| Slack | Slack Web API + Events API | Outbound posts and inbound capture, signature-verified. |
| Ingestion | SheetJS (xlsx) → LLM structuring | Parse the file, Claude shapes tasks, you approve before insert. |

---

## 10. Delivery plan

Shippable at every step — a usable board before any AI.

- **Phase 0 — Foundation:** Supabase project, schema, Google SSO, RLS, seed your real team.
- **Phase 1 — Core:** projects & tasks; Table + Board + My Day; inline edit; multi-select bulk edit; realtime. _This alone replaces the old tool._
- **Phase 2 — Talk to it:** MCP server; create / update / bulk-change / query by chatting. The vibe loop goes live.
- **Phase 3 — Slack:** outbound notifications per channel; inbound daily-update parsing; optional morning digest.
- **Phase 4 — Ingest:** upload Excel or a rough plan → Claude drafts tasks, dates, dependencies → one-click review.
- **Phase 5 — Polish:** dependency-aware timeline, workload views, overdue/at-risk surfacing, reporting.

---

## 11. Decisions that shape v1

Tell me your calls (or "your pick") and I'll lock the plan and start on Phase 0.

1. **Identity** — Google Workspace SSO, or email magic links?
2. **Team & scale** — how many people and projects at launch; who are owners/admins vs members?
3. **MCP hosting** — remote hosted (connect Claude from anywhere), or local-only to start?
4. **Slack setup** — which workspace; one channel per project or one shared updates channel?
5. **Dependencies** — should a slipped task auto-reschedule its dependents, or just flag them?
6. **Direct Supabase** — enable raw Supabase-to-Claude for bulk seeding, or keep everything behind the custom MCP?
7. **v1 scope** — is "usable board + MCP" enough for a first cut, with Slack and ingestion right after?
8. **Repo & name** — build in `pphrscanner2`, `nexis-student-compass`, or a fresh repo? Keep the name "Vibe PM"?

---

_Technical brief v0.1 — a starting point to define further, not a final spec._
