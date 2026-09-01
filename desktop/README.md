# Vibe Timer — desktop app

A tiny cross-platform (Windows / macOS / Linux) time-tracking companion to Vibe
PM. It signs in through your browser, makes you pick a task before the clock
starts, and lets you record breaks. Everything it logs writes to the same
Supabase backend as the web app, so it shows up in the web Time Log / Timeline
views automatically.

Built with **Electron + electron-vite + React + zustand**.

## What it does

- **Browser sign-in.** Clicking _Sign in_ opens your system browser at the web
  app's `/desktop-auth` page. You complete the normal magic-link login there (or
  you're already signed in), and the resulting Supabase session is handed back to
  the app over a short-lived **loopback** server (`127.0.0.1:<random-port>`).
  Your password never touches the desktop app — it only ever receives a signed
  session, and only from `127.0.0.1`.
- **Auto-start + forced task pick.** On first packaged run it registers to launch
  at login. On launch it shows a task picker (your **My Day** plan first, then
  your open assigned tasks) — the timer only starts once you choose a task.
- **Breaks.** Start a break (short / lunch / away) from the running timer or the
  picker. Work done so far is logged, then the break is timed and written to the
  `breaks` table. Ending a break drops you back to the task picker.
- **Pick any task.** The picker defaults to your assigned tasks, with a
  **Show all tasks** switch to start a timer on anyone's task.
- **Mini overlay.** A tiny always-on-top pill shows the running timer on top of
  everything, draggable, with a stop button; click it to open the app. Toggle it
  from the header menu (_Mini timer overlay_).
- **My time entries.** The list icon in the header opens every time entry you've
  logged (work + breaks), grouped by day with per-day totals.
- **Idle nudge.** If you're neither on a task nor a break, it surfaces the window
  and a notification every 5 minutes prompting you to pick one.
- **Comment on your task.** Add a comment to the task you're timing straight from
  the running-timer screen (writes to the shared `comments` table).
- **Tray presence.** Lives in the system tray; the tooltip shows the live
  elapsed time. Closing the window hides to tray; _Quit_ from the tray exits.

## Prerequisites

1. The **`breaks` table** must exist in Supabase. From the repo root:

   ```bash
   npm run db:breaks
   ```

2. The web app's desktop-auth URL must be in **Supabase → Authentication → URL
   Configuration → Redirect URLs**. For this project these are **already
   configured**:

   ```
   http://localhost:3000/desktop-auth
   https://vibe-pm-six.vercel.app/desktop-auth
   ```

   (The magic link returns to this page, which then hands the session to the app.)

## Setup

```bash
cd desktop
cp .env.example .env      # fill in Supabase URL + anon key, and the web app origin
npm install
npm run icons             # generate app/tray icons
npm run dev               # launch in development
```

`.env` keys:

| key                         | purpose                                                        |
| --------------------------- | ------------------------------------------------------------- |
| `VITE_SUPABASE_URL`         | Supabase project URL (same as the web app)                    |
| `VITE_SUPABASE_ANON_KEY`    | Supabase anon key (already public in the web app)             |
| `VITE_APP_TODAY`            | Calendar date to read/write under. Defaults to `2026-08-26` to match the web app's frozen clock; set empty to use the real date. |
| `MAIN_VITE_WEB_LOGIN_URL`   | Origin serving `/desktop-auth` — deployed `https://vibe-pm-six.vercel.app` (no local server needed) or `http://localhost:3000` for dev |

## Build installers

```bash
npm run typecheck
npm run dist:win     # NSIS installer  → release/
npm run dist:mac     # dmg (build on macOS; unsigned unless you add certs)
npm run dist:linux   # AppImage
```

Each OS installer must be built on (or cross-built for) that OS. macOS builds are
unsigned/un-notarized unless you supply signing credentials to electron-builder.

## How auth stays safe

- The loopback server only accepts a payload carrying the exact `state` nonce it
  generated, and it only ever listens on `127.0.0.1`.
- Tokens travel in the URL **fragment** to the loopback page, which reads them
  client-side and POSTs them back same-origin — they never appear in a request
  line, query string, or server log.
- The app only redirects to `127.0.0.1`, so there's no open-redirect surface.
