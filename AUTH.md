# Authentication (password or magic link)

Team members sign in with their **email**, either way:

- **Password** — `signInWithPassword`. Fast, no inbox round-trip.
- **Magic link** — `signInWithOtp`, the original flow. Also the way in when
  someone has no password yet or has forgotten it.

Both sit on one screen ([components/LoginPage.tsx](components/LoginPage.tsx)):
email, password, **Sign in**, then an **Email me a magic link** button below.
Enter does the obvious thing — password if one is typed, magic link if not.

## Setting a password

Anyone can set or change their own under **Settings → Account**
([components/AccountCard.tsx](components/AccountCard.tsx)) — it calls
`auth.updateUser({ password })` on the signed-in session, so no admin and no
reset email are involved. New members therefore start with the magic link,
then set a password if they want one. Forgotten passwords take the same route:
sign in with the link, set a new one. Minimum 8 characters, confirmed twice.

## How it works

- `lib/supabase/client.ts` enables `persistSession` + `detectSessionInUrl`.
- `components/LoginPage.tsx` offers both `signInWithPassword` and
  `signInWithOtp({ email })` on one screen.
- `components/AccountCard.tsx` (Settings → Account) sets a password for the
  signed-in user.
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
