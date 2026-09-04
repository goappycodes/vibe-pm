import {
  createClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

/**
 * Admin-only account management for team members.
 *
 * Everything about a member that lives in `team_members` (name, role, lead,
 * timezone…) is written straight from the client under RLS. The two things that
 * live in Supabase Auth — the sign-in address and the password — can only be
 * changed with the service-role key, so they come through here. The caller's
 * session token is verified on every request and must belong to an admin.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MIN_PASSWORD = 8;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function adminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const same = (a: string | null | undefined, b: string | null | undefined) =>
  (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();

/** The caller's own member row, or a message saying why they can't be here. */
async function callerRole(
  sb: SupabaseClient,
  req: NextRequest
): Promise<{ email: string } | { error: string; status: number }> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { error: "Not signed in.", status: 401 };

  const { data, error } = await sb.auth.getUser(token);
  const email = data.user?.email;
  if (error || !email)
    return { error: "Your session expired — sign in again.", status: 401 };

  // Service role, so this reads regardless of RLS.
  const { data: rows, error: readError } = await sb
    .from("team_members")
    .select("email, role");
  if (readError) return { error: readError.message, status: 500 };

  const me = (rows ?? []).find((r) => same(r.email as string, email));
  if (!me || me.role !== "admin")
    return { error: "Only admins can manage sign-in accounts.", status: 403 };
  return { email };
}

/**
 * Look up an auth user by address. The admin API has no "get by email", so page
 * through — a team is small enough that this stays a single request in practice.
 */
async function findAuthUser(
  sb: SupabaseClient,
  email: string
): Promise<User | null> {
  const perPage = 200;
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);
    const hit = data.users.find((u) => same(u.email, email));
    if (hit) return hit;
    if (data.users.length < perPage) return null;
  }
  return null;
}

const fail = (error: string, status = 400) =>
  NextResponse.json({ ok: false, error }, { status });

export async function POST(req: NextRequest) {
  const sb = adminClient();
  if (!sb)
    return fail(
      "Account management needs SUPABASE_SERVICE_ROLE_KEY on the server.",
      501
    );

  let body: {
    action?: unknown;
    memberId?: unknown;
    email?: unknown;
    password?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return fail("bad json");
  }

  const caller = await callerRole(sb, req);
  if ("error" in caller) return fail(caller.error, caller.status);

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const action = body.action;

  // --- does this address have a sign-in account? -------------------------
  if (action === "lookup") {
    if (!email) return fail("No email to look up.");
    try {
      const user = await findAuthUser(sb, email);
      return NextResponse.json({
        ok: true,
        exists: !!user,
        lastSignInAt: user?.last_sign_in_at ?? null,
        confirmed: !!(user?.email_confirmed_at ?? user?.confirmed_at),
      });
    } catch (e) {
      return fail((e as Error).message, 500);
    }
  }

  // --- change the address and/or set a password --------------------------
  if (action === "save") {
    const memberId = typeof body.memberId === "string" ? body.memberId : "";
    const password =
      typeof body.password === "string" && body.password ? body.password : null;
    if (!memberId) return fail("Which member?");
    if (!email || !EMAIL_RE.test(email))
      return fail("That doesn't look like an email address.");
    if (password && password.length < MIN_PASSWORD)
      return fail(`Passwords need at least ${MIN_PASSWORD} characters.`);

    const { data: members, error: readError } = await sb
      .from("team_members")
      .select("id, email");
    if (readError) return fail(readError.message, 500);

    const member = (members ?? []).find((m) => m.id === memberId);
    if (!member) return fail("That member no longer exists.", 404);
    if ((members ?? []).some((m) => m.id !== memberId && same(m.email, email)))
      return fail("Another team member already uses that email.", 409);

    const previousEmail = (member.email as string) ?? "";
    const changingEmail = !!previousEmail && !same(previousEmail, email);

    try {
      const current = previousEmail
        ? await findAuthUser(sb, previousEmail)
        : null;
      const atNewAddress = changingEmail
        ? await findAuthUser(sb, email)
        : current;

      if (atNewAddress && current && atNewAddress.id !== current.id)
        return fail("Another sign-in account already uses that email.", 409);

      let account: "created" | "updated" | "none" = "none";

      if (current && changingEmail) {
        // email_confirm skips the "confirm your new address" email — an admin
        // changing it is the confirmation.
        const { error } = await sb.auth.admin.updateUserById(current.id, {
          email,
          email_confirm: true,
        });
        if (error) return fail(error.message, 500);
        account = "updated";
      }

      if (password) {
        const target = current ?? atNewAddress;
        if (target) {
          const { error } = await sb.auth.admin.updateUserById(target.id, {
            password,
          });
          if (error) return fail(error.message, 500);
          account = "updated";
        } else {
          // No account yet (never signed in): the password creates one, ready
          // to use immediately without waiting on a magic link.
          const { error } = await sb.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
          });
          if (error) return fail(error.message, 500);
          account = "created";
        }
      }

      return NextResponse.json({ ok: true, account, email });
    } catch (e) {
      return fail((e as Error).message, 500);
    }
  }

  return fail("Unknown action.");
}
