"use client";

import { supabase } from "@/lib/supabase/client";
import type { Session } from "@supabase/supabase-js";
import {
  CheckCircle2,
  Loader2,
  Mail,
  MonitorSmartphone,
  TriangleAlert,
} from "lucide-react";
import { Suspense, useCallback, useEffect, useState } from "react";

/**
 * Login bridge for the desktop timer app.
 *
 * The desktop app opens this page in the system browser with ?port=&state=,
 * pointing at a short-lived loopback server it started (127.0.0.1:<port>). Once
 * the user has a Supabase session here (either already signed in, or via a fresh
 * magic link), we hand the session tokens back to that loopback server by
 * navigating to it with the tokens in the URL *fragment* — the fragment never
 * reaches the loopback server as a request, it's read client-side by the page
 * the loopback serves, so tokens stay out of any server log or query string.
 *
 * We only ever redirect to 127.0.0.1, so there's no open-redirect surface.
 */

type Phase = "checking" | "need-login" | "sent" | "delivering" | "bad-params";

function DesktopAuthInner() {
  const [phase, setPhase] = useState<Phase>("checking");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const params =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams();
  const portRaw = params.get("port");
  const state = params.get("state") ?? "";
  const port = portRaw ? Number(portRaw) : NaN;
  const validParams =
    Number.isInteger(port) && port > 0 && port < 65536 && state.length > 0;

  const deliver = useCallback(
    (session: Session) => {
      setPhase("delivering");
      const frag = new URLSearchParams({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: String(session.expires_at ?? ""),
        state,
      });
      // Fragment, not query — keeps tokens off the wire to the loopback server.
      window.location.href = `http://127.0.0.1:${port}/callback#${frag.toString()}`;
    },
    [port, state]
  );

  useEffect(() => {
    if (!validParams) {
      setPhase("bad-params");
      return;
    }
    if (!supabase) {
      setError("This deployment has no auth backend configured.");
      setPhase("need-login");
      return;
    }
    // Already signed in on this browser? Hand the session over immediately.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) deliver(data.session);
      else setPhase("need-login");
    });
    // Magic-link return lands here and establishes the session asynchronously.
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) deliver(session);
    });
    return () => sub.subscription.unsubscribe();
  }, [validParams, deliver]);

  const submit = async () => {
    const addr = email.trim();
    if (!addr || !supabase) return;
    setLoading(true);
    setError(null);
    // Return to THIS page (with port+state intact) after the magic link.
    const { error } = await supabase.auth.signInWithOtp({
      email: addr,
      options: { emailRedirectTo: window.location.href },
    });
    setLoading(false);
    if (error) setError(error.message);
    else setPhase("sent");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-fg">
            <MonitorSmartphone className="h-5 w-5" strokeWidth={2.2} />
          </div>
          <div className="leading-tight">
            <div className="text-base font-semibold text-fg">Vibe Timer</div>
            <div className="text-xs text-faint">Desktop sign-in</div>
          </div>
        </div>

        {phase === "checking" && (
          <div className="card flex items-center gap-3 p-6">
            <Loader2 className="h-5 w-5 animate-spin text-faint" />
            <span className="text-sm text-muted">Checking your session…</span>
          </div>
        )}

        {phase === "bad-params" && (
          <div className="card p-6 text-center">
            <TriangleAlert className="mx-auto h-9 w-9 text-amber-500" />
            <h1 className="mt-3 text-lg font-semibold text-fg">
              Open this from the app
            </h1>
            <p className="mt-1 text-sm text-muted">
              This page signs the desktop timer app in. Start it from the app&apos;s
              <span className="font-medium text-fg"> Sign in</span> button.
            </p>
          </div>
        )}

        {phase === "delivering" && (
          <div className="card p-6 text-center">
            <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-500" />
            <h1 className="mt-3 text-lg font-semibold text-fg">You&apos;re in</h1>
            <p className="mt-1 text-sm text-muted">
              Handing your session to the desktop app… you can close this tab and
              return to <span className="font-medium text-fg">Vibe Timer</span>.
            </p>
          </div>
        )}

        {phase === "sent" && (
          <div className="card p-6 text-center">
            <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-500" />
            <h1 className="mt-3 text-lg font-semibold text-fg">
              Check your email
            </h1>
            <p className="mt-1 text-sm text-muted">
              We sent a magic sign-in link to{" "}
              <span className="font-medium text-fg">{email}</span>. Open it in
              this browser to finish — keep this tab open.
            </p>
            <button
              onClick={() => {
                setPhase("need-login");
                setEmail("");
              }}
              className="btn-ghost mt-4 text-sm text-muted"
            >
              Use a different email
            </button>
          </div>
        )}

        {phase === "need-login" && (
          <div className="card p-6">
            <h1 className="text-lg font-semibold text-fg">Sign in to continue</h1>
            <p className="mt-1 text-sm text-muted">
              Enter your Appycodes email and we&apos;ll send a magic link. Signing
              in here connects the desktop timer app.
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
              {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
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
          Your password never touches the desktop app — it receives only a signed
          session, over a local loopback connection.
        </p>
      </div>
    </div>
  );
}

export default function DesktopAuthPage() {
  return (
    <Suspense fallback={null}>
      <DesktopAuthInner />
    </Suspense>
  );
}
