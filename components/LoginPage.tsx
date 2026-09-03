"use client";

import { supabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Send,
  Sparkles,
} from "lucide-react";
import { useState } from "react";

type Busy = "password" | "link" | null;

/** Supabase's wording is terse; say what to do about it. */
function friendly(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials"))
    return "Wrong email or password. Never set one? Use the magic link below.";
  if (m.includes("email not confirmed"))
    return "This address isn't confirmed yet — use the magic link to finish signing in.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Too many attempts just now. Wait a minute and try again.";
  return message;
}

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addr = email.trim();

  const signInWithPassword = async () => {
    if (!addr || !password || !supabase || busy) return;
    setBusy("password");
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: addr,
      password,
    });
    setBusy(null);
    if (error) setError(friendly(error.message));
  };

  const sendMagicLink = async () => {
    if (!addr || !supabase || busy) return;
    setBusy("link");
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: addr,
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(null);
    if (error) setError(friendly(error.message));
    else setSent(true);
  };

  // One Enter key, the obvious outcome: password if typed, link if not.
  const onEnter = () => (password ? signInWithPassword() : sendMagicLink());

  if (sent) {
    return (
      <Shell>
        <div className="card p-6 text-center">
          <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-500" />
          <h1 className="mt-3 text-lg font-semibold text-fg">Check your email</h1>
          <p className="mt-1 text-sm text-muted">
            We sent a sign-in link to{" "}
            <span className="font-medium text-fg">{addr}</span>. Open it on this
            device to continue.
          </p>
          <button
            onClick={() => {
              setSent(false);
              setPassword("");
            }}
            className="btn-ghost mt-4 text-sm text-muted"
          >
            Back to sign in
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="card p-6">
        <h1 className="text-lg font-semibold text-fg">Sign in</h1>
        <p className="mt-1 text-sm text-muted">
          Use your password, or have a one-time link emailed to you.
        </p>

        <div className="mt-4 space-y-2.5">
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input
              type="email"
              autoFocus
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onEnter()}
              placeholder="you@appycodes.com"
              className="w-full rounded-lg border border-border bg-surface py-2.5 pl-9 pr-3 text-sm text-fg outline-none placeholder:text-faint focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </div>

          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onEnter()}
              placeholder="Password"
              className="w-full rounded-lg border border-border bg-surface py-2.5 pl-9 pr-10 text-sm text-fg outline-none placeholder:text-faint focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-faint transition-colors hover:bg-surface-2 hover:text-fg"
              aria-label={showPassword ? "Hide password" : "Show password"}
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}

        <button
          onClick={signInWithPassword}
          disabled={!addr || !password || busy !== null}
          className={cn(
            "btn-primary mt-3 w-full justify-center gap-2 py-2.5",
            (!addr || !password || busy !== null) && "opacity-50"
          )}
        >
          {busy === "password" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </button>

        <div className="my-3 flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="text-[11px] uppercase tracking-wide text-faint">
            or
          </span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <button
          onClick={sendMagicLink}
          disabled={!addr || busy !== null}
          className={cn(
            "btn-outline w-full justify-center gap-2 py-2.5",
            (!addr || busy !== null) && "opacity-50"
          )}
        >
          {busy === "link" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Sending…
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Email me a magic link
            </>
          )}
        </button>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-faint">
          No password yet, or forgotten it? Sign in with the magic link, then set
          one under <span className="text-muted">Settings → Account</span>.
        </p>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
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
        {children}
        <p className="mt-4 text-center text-[11px] text-faint">
          Team members sign in with their email. Access is scoped to your role.
        </p>
      </div>
    </div>
  );
}
