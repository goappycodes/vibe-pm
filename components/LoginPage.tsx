"use client";

import { supabase } from "@/lib/supabase/client";
import { CheckCircle2, Loader2, Mail, Sparkles } from "lucide-react";
import { useState } from "react";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const addr = email.trim();
    if (!addr || !supabase) return;
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: addr,
      options: { emailRedirectTo: window.location.origin },
    });
    setLoading(false);
    if (error) setError(error.message);
    else setSent(true);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-fg">
            <Sparkles className="h-5 w-5" strokeWidth={2.2} />
          </div>
          <div className="leading-tight">
            <div className="text-base font-semibold text-fg">Vibe PM</div>
            <div className="text-xs text-faint">Appycodes</div>
          </div>
        </div>

        {sent ? (
          <div className="card p-6 text-center">
            <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-500" />
            <h1 className="mt-3 text-lg font-semibold text-fg">
              Check your email
            </h1>
            <p className="mt-1 text-sm text-muted">
              We sent a magic sign-in link to{" "}
              <span className="font-medium text-fg">{email}</span>. Open it on
              this device to continue.
            </p>
            <button
              onClick={() => {
                setSent(false);
                setEmail("");
              }}
              className="btn-ghost mt-4 text-sm text-muted"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <div className="card p-6">
            <h1 className="text-lg font-semibold text-fg">Sign in</h1>
            <p className="mt-1 text-sm text-muted">
              Enter your Appycodes email and we&apos;ll send a magic link — no
              password needed.
            </p>
            <div className="mt-4">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
                <input
                  type="email"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submit();
                  }}
                  placeholder="you@appycodes.com"
                  className="w-full rounded-lg border border-border bg-surface py-2.5 pl-9 pr-3 text-sm text-fg outline-none placeholder:text-faint focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
              </div>
              {error && (
                <p className="mt-2 text-xs text-rose-600">{error}</p>
              )}
              <button
                onClick={submit}
                disabled={loading || !email.trim()}
                className="btn-primary mt-3 w-full justify-center gap-2 py-2.5 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  "Send magic link"
                )}
              </button>
            </div>
          </div>
        )}
        <p className="mt-4 text-center text-[11px] text-faint">
          Team members sign in with their email. Access is scoped to your role.
        </p>
      </div>
    </div>
  );
}
