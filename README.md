# Vibe PM — Frontend

A fast, AI-native project manager for Appycodes. Built on Next.js, backed by **Supabase** (Postgres + realtime) with a **bundled-JSON fallback**. It mirrors the surfaces described in the [technical brief](vibepmbrief-short.md).

## Stack

- **Next.js 14** (App Router) + TypeScript
- **Supabase** — Postgres, RLS, realtime ([SUPABASE.md](SUPABASE.md))
- **Tailwind CSS** — light/dark theme via CSS variables
- **Zustand** — in-memory store: instant render, optimistic writes persisted to Supabase, realtime sync
- **@dnd-kit** — drag-and-drop on the board
- **date-fns**, **lucide-react**

## Data & speed

Renders bundled `data/*.json` **instantly**, then hydrates from Supabase and goes live over realtime. Every edit is applied in memory immediately and persisted in the background; if Supabase isn't configured it stays on the bundled data. See [SUPABASE.md](SUPABASE.md) for schema + env setup (`npm run db:setup`).

## The four surfaces

| View | What it does |
|---|---|
| **My Day** | Your tasks grouped by Overdue / Today / Tomorrow / This week / Later, sorted by urgency + due date. |
| **Table** | Dense grid — inline-editable cells, multi-select, sortable columns, and a bulk-edit toolbar (reassign / restatus / reschedule many at once). |
| **Board** | Kanban by status with drag-and-drop between columns. |
| **Timeline** | Gantt-style view — bars sized by effort, a "today" line, and dependency connectors that turn red where a slip puts a dependent at risk. |

Plus: a **command palette** (`⌘K` / `Ctrl-K`) to jump between views and search tasks, and a **task detail drawer** with editable fields, dependencies, and an activity log.

## Signature behaviors

- **Auto-reschedule on slip** — pushing a task's due date later cascades its dependents forward along the chain (see `cascadeReschedule` in [lib/store.ts](lib/store.ts)).
- **Optimistic, instant edits** — every change is applied in memory immediately and written to the activity log.

## Mock data

Static JSON under [`/data`](data) — `tasks`, `team_members`, `projects`, `task_dependencies`, `updates`, `activity_log`. The board is anchored to **2026-08-26** so relative dates (overdue / today) stay coherent. Current user is Ritesh Agarwal (`u1`).

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:3000 (redirects to My Day).

```bash
npm run build
```

## Structure

```
app/            # routes: my-day, table, board, timeline
components/     # Sidebar, Topbar, pickers, drawer, command palette, cards
lib/            # types, zustand store, utils
data/           # static JSON mock data
```

> This is a UI prototype. The real system writes to one Postgres database in Supabase, with Claude connecting directly and Slack echoing changes both ways — see the brief.
