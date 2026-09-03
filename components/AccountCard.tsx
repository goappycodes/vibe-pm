"use client";

import { authRequired, supabase } from "@/lib/supabase/client";
import { useStore } from "@/lib/store";
import { Check, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

const MIN_LENGTH = 8;

/**
 * Set or change your own password — available to every role, since a password
 * is how you sign in without waiting on a magic-link email. Users created by
 * magic link have no password until they set one here.
 */
export function AccountCard() {
  const currentUser = useStore((s) =>
    s.members.find((m) => m.id === s.currentUserId)
  );
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => {
      setAuthEmail(data.user?.email ?? null);
      // Supabase reports which methods are attached to the account.
      const providers = (data.user?.app_metadata?.providers as string[]) ?? [];
      setHasPassword(providers.includes("email") && !!data.user?.last_sign_in_at);
    });
  }, []);

  if (!authRequired) return null;

  const tooShort = password.length > 0 && password.length < MIN_LENGTH;
  const mismatch = confirm.length > 0 && password !== confirm;
  const ready = password.length >= MIN_LENGTH && password === confirm && !saving;

  const save = async () => {
    if (!ready || !supabase) return;
    setSaving(true);
    setError(null);
    setDone(false);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setPassword("");
    setConfirm("");
    setDone(true);
    setHasPassword(true);
  };

  return (
    <section className="card mt-4 p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-2 text-muted">
          <KeyRound className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-fg">Account</h2>
          <p className="mt-0.5 text-xs text-muted">
            {authEmail ?? currentUser?.email ?? "Signed in"} ·{" "}
            {hasPassword === null
              ? "checking…"
              : "set a password to sign in without the emailed link"}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
        <div className="relative">
          <input
            type={show ? "text" : "password"}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New password"
            className="input pr-10"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-faint transition-colors hover:bg-surface-2 hover:text-fg"
            aria-label={show ? "Hide password" : "Show password"}
            tabIndex={-1}
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <input
          type={show ? "text" : "password"}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder="Confirm password"
          className="input"
        />
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={save}
          disabled={!ready}
          className="btn-primary gap-1.5 disabled:opacity-50"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Update password
        </button>
        {tooShort && (
          <span className="text-xs text-muted">
            At least {MIN_LENGTH} characters.
          </span>
        )}
        {!tooShort && mismatch && (
          <span className="text-xs text-amber-600 dark:text-amber-400">
            The two passwords don&apos;t match.
          </span>
        )}
        {error && <span className="text-xs text-rose-600">{error}</span>}
        {done && (
          <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
            <Check className="h-3.5 w-3.5" />
            Password updated — use it next time you sign in.
          </span>
        )}
      </div>
    </section>
  );
}
