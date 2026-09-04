"use client";

import { supabase } from "@/lib/supabase/client";

/** Escape the wildcards PostgREST's `ilike` would otherwise honour. */
const escapeLike = (s: string) => s.replace(/([%_\*])/g, "\$1");

export type MembershipCheck = { known: boolean; verified: boolean };

/**
 * Is this address on the team?
 *
 * A magic link creates the auth user on demand, so without this check any
 * address at all — a typo, an ex-colleague, a stranger — gets a working link
 * for an account that maps to no member. `verified: false` means the lookup
 * itself failed; callers should let the sign-in through rather than lock a real
 * member out over a network blip.
 */
export async function isTeamEmail(email: string): Promise<MembershipCheck> {
  const addr = email.trim();
  if (!supabase || !addr) return { known: true, verified: false };
  const { data, error } = await supabase
    .from("team_members")
    .select("email")
    .ilike("email", escapeLike(addr))
    .limit(5);
  if (error) {
    console.error("[auth] membership check failed:", error.message);
    return { known: true, verified: false };
  }
  const known = (data ?? []).some(
    (m) => (m.email as string).trim().toLowerCase() === addr.toLowerCase()
  );
  return { known, verified: true };
}

type AdminResponse = {
  ok: boolean;
  error?: string;
  exists?: boolean;
  lastSignInAt?: string | null;
  confirmed?: boolean;
  account?: "created" | "updated" | "none";
};

/** Every admin account call carries the caller's session for the server to check. */
async function adminCall(body: object): Promise<AdminResponse> {
  if (!supabase) return { ok: false, error: "No auth backend configured." };
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, error: "Sign in again to continue." };
  try {
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    return (await res.json()) as AdminResponse;
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Whether this address can already sign in, and when it last did. */
export function lookupAccount(email: string) {
  return adminCall({ action: "lookup", email });
}

/**
 * Apply the auth half of an edit: move the sign-in address, set a password,
 * or create the account outright if the member has never signed in.
 */
export function saveAccount(input: {
  memberId: string;
  email: string;
  password?: string;
}) {
  return adminCall({ action: "save", ...input });
}
