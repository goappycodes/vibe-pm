# Vibe Timer — user guide

A small desktop time-tracker for Appycodes tasks. It signs in through your
browser, keeps a timer on the task you're working on, tracks breaks, and records
whether you're active or idle. Everything syncs to Vibe PM.

---

## 1. Download the right file

Get the files from the project's **GitHub Releases** page (latest = `v0.1.1`):

| Your system | Download | How to run |
| --- | --- | --- |
| **Windows** (10/11) | `Vibe-Timer-Setup-0.1.1.exe` | Double-click to install. SmartScreen may warn (unsigned) → **More info → Run anyway**. |
| **Windows (no install)** | `Vibe-Timer-0.1.1-win-x64.zip` *(portable)* | Unzip, run `Vibe Timer.exe`. Nothing to install. |
| **macOS** (Apple Silicon — M1/M2/M3) | `Vibe-Timer-0.1.1-arm64.dmg` | Open the dmg, drag to Applications. First launch: **right-click → Open** (unsigned). |
| **Linux** | `Vibe-Timer-0.1.1.AppImage` | `chmod +x Vibe-Timer-0.1.1.AppImage` then run it. |

> The `.blockmap` and `latest*.yml` files are for auto-updates — **you don't
> download those**.
>
> Intel Macs: the current dmg is Apple-Silicon only. Ask the maintainer for an
> Intel/universal build if you need one.

---

## 2. Sign in

1. Launch the app and click **Sign in with browser**.
2. Your browser opens the Vibe PM sign-in page. Enter your Appycodes email and
   open the magic link (or, if you're already signed into Vibe PM, it connects
   instantly).
3. You're returned to the app. Your password never touches the app — it only
   receives a signed session.

---

## 3. Track your time

- **Pick a task** to start the timer. The picker shows your assigned tasks; flip
  **Show all tasks** to time any task, or **+** to create a new one.
- While a timer runs you can:
  - **Stop & log** — saves the time to the task.
  - **Switch task** — logs the current one and pick another.
  - **Break** — short / lunch / away (tracked separately from work).
  - **Status chip / Mark complete** — move the task's status, or complete it
    (completing logs the time, sets it done, and returns you to the picker).
  - **Add a comment** on the task.

## 4. Breaks

Start a break from the running timer or the picker. Ending a break brings you
back to the task picker. Break time is recorded separately and never counts as
work.

## 5. The mini overlay

A tiny always-on-top pill shows your running timer on top of everything —
drag it anywhere, click to open the app, or hit its stop button. Toggle it from
the header menu (**Mini timer overlay**).

## 6. Your time entries

The **list icon** in the header shows everything you've logged, grouped by day.
Need to fix one? **Add a missing entry**, or use the edit / delete buttons — the
change goes to your team lead for approval and, once approved, the entry is
flagged *edited*.

## 7. Good to know

- **It runs in the tray.** Closing the window hides it; quit from the tray icon.
- **Starts on login** by default (toggle it in the header menu).
- **Sleep / lock** stops the running timer so away time isn't counted.
- **Idle nudge:** if you're neither on a task nor a break, the app pops up every
  minute to remind you.
- **Activity:** it records active-vs-idle minutes (input activity only — no
  keystrokes, screenshots, or window titles). Admins/leads see day breakdowns in
  the Vibe PM web app under **Activity**.

## 8. Updating

Once the maintainer publishes a new release, the installed app auto-updates on
next launch (the portable zip does not — re-download it).

## Troubleshooting

- **"missing supabase configuration"** — you're on an old build. Download the
  latest release.
- **Nothing appears on launch** — an older copy may still be running in the
  tray/holding the single-instance lock. Quit it from the tray and relaunch.
- **Sign-in doesn't return** — keep the browser tab open until it says you can
  return to the app; retry from **Sign in** if it times out.
