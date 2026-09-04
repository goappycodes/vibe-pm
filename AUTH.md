# Authentication (password or magic link)

Team members sign in with their **email**, either way:

- **Password** — `signInWithPassword`. Fast, no inbox round-trip.
- **Magic link** — `signInWithOtp`, the original flow. Also the way in when
  someone has no password yet or has forgotten it.

Both sit on one screen ([components/LoginPage.tsx](components/LoginPage.tsx)):
email, password, **Sign in**, then an **Email me a magic link** button below.
Enter does the obvious thing — password if one is typed, magic link if not.

## Only team members get a link

A magic link **creates the account on the spot**, so before sending one the app
checks the address against `team_members` (`isTeamEmail` in
[lib/auth/accounts.ts](lib/auth/accounts.ts)). An address nobody has added gets
"…isn't on the team yet. Ask an admin to add you under Team" and no email is
sent. The same guard covers the desktop sign-in bridge (`/desktop-auth`). If the
lookup itself fails (offline, PostgREST down) the sign-in is allowed through
rather than locking out a real member.

## Setting a password

Anyone can set or change their own under **Settings → Account**
([components/AccountCard.tsx](components/AccountCard.tsx)) — it calls
`auth.updateUser({ password })` on the signed-in session, so no admin and no
reset email are involved. New members therefore start with the magic link,
then set a password if they want one. Forgotten passwords take the same route:
sign in with the link, set a new one. Minimum 8 characters, confirmed twice.

## Admins managing members

**Team → pencil** opens [components/MemberDialog.tsx](components/MemberDialog.tsx),
where an admin edits a member's name, email, role, lead, Slack user ID and
timezone, and can set their password. **Add member** uses the same dialog, so a
member arrives with details filled in rather than as an empty row.

Name, role and the rest are ordinary `team_members` writes. The two fields that
also live in Supabase Auth go through **`POST /api/admin/users`**
([app/api/admin/users/route.ts](app/api/admin/users/route.ts)), which holds the
service-role key:

- `action: "lookup"` — does this address have a sign-in account, and when did it
  last sign in? (Shown in the dialog.)
- `action: "save"` — moves the auth account to a new address (`email_confirm`, so
  no confirmation email), sets a password, or **creates** the account outright
  when the member has never signed in. That last case is how an admin hands
  someone a working password without any email round-trip.

Every request carries the caller's session token; the route re-reads their
`team_members` row server-side and refuses anyone who isn't an admin — being
signed in is not enough. Email is deliberately **not** editable inline on the
Team page: it is also the sign-in address, so it has to move the auth account
with it.

Note that removing a member deletes their `team_members` row but leaves their
auth account, so revoking access still means deleting the user in the Supabase
dashboard.

## How it works

- `lib/supabase/client.ts` enables `persistSession` + `detectSessionInUrl`.
- `components/LoginPage.tsx` offers both `signInWithPassword` and
  `signInWithOtp({ email })` on one screen.
- `components/AccountCard.tsx` (Settings → Account) sets a password for the
  signed-in user.
- `app/api/admin/users/route.ts` + `lib/auth/accounts.ts` are the admin path:
  address changes, password sets and account creation, admin-checked server-side.
  It needs `SUPABASE_SERVICE_ROLE_KEY` on the server (already required by the
  daily-alerts route) — without it the route answers 501 and the profile fields
  still save.
- `components/AppShell.tsx` checks the session (`getSession` + `onAuthStateChange`):
  shows a loader while checking, the login page if signed out, the app if signed
  in. Hydration/realtime only run once signed in.
- On sign-in, `setCurrentUserByEmail` points "current user" at the matching member.
- Sign out lives in the sidebar footer.
- **No backend configured** (`NEXT_PUBLIC_SUPABASE_*` unset) ⇒ auth is skipped and
  the app runs open on bundled demo data.

## Required Supabase dashboard config

Magic-link **email delivery** and **redirects** are GoTrue settings — set them in
the dashboard (they can't be scripted without a personal access token):

1. **Auth → URL Configuration → Redirect URLs**: add every origin the app runs on
   so the emailed link can return to it:
   - `http://localhost:3000`
   - your Vercel URL, e.g. `https://vibe-pm-six.vercel.app`
   (Also set **Site URL** to the primary one.)
2. **Auth → Providers → Email**: ensure Email is enabled (it is by default).
3. **Auth → Emails / SMTP**: the built-in sender is heavily rate-limited (a few
   per hour) and often lands in spam. For a real team, configure **custom SMTP**.

Until redirect URLs are allowlisted, a member clicking the emailed link will fail
to return to the app.

## Vercel

The deployed app requires login **only if** `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` are set in the Vercel project. Set them once the
redirect URLs above are configured.

## Hardening (recommended next)

RLS is still permissive (`using (true)`) so the anon key can read/write — the
login gate is enforced in the UI, not the database. Once auth is in place,
tighten the policies to `to authenticated` (and scope by `auth.uid()` / role) so
the data is protected at the database level too.
