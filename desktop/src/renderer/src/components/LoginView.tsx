import { Loader2, Timer, TriangleAlert } from "lucide-react";
import { useStore } from "../lib/store";

export function LoginView() {
  const signIn = useStore((s) => s.signIn);
  const phase = useStore((s) => s.phase);
  const authError = useStore((s) => s.authError);
  const waiting = phase === "authenticating";

  return (
    <div className="screen center">
      <div className="dot" style={{ width: 46, height: 46 }}>
        <Timer style={{ width: 24, height: 24 }} />
      </div>
      <h1>Vibe Timer</h1>
      <p className="muted small" style={{ maxWidth: 260 }}>
        Track your time against Appycodes tasks. Sign in with your browser to
        get started.
      </p>
      <button
        className="btn btn-primary btn-lg btn-block"
        style={{ maxWidth: 260, marginTop: 12 }}
        onClick={() => signIn()}
        disabled={waiting}
      >
        {waiting ? (
          <>
            <Loader2 className="icon spin" /> Waiting for browser…
          </>
        ) : (
          "Sign in with browser"
        )}
      </button>
      {authError && (
        <p
          className="small"
          style={{
            color: "var(--danger)",
            maxWidth: 280,
            display: "flex",
            gap: 6,
            alignItems: "flex-start",
            marginTop: 10,
          }}
        >
          <TriangleAlert className="icon" style={{ marginTop: 2 }} />
          <span>{authError}</span>
        </p>
      )}
      <p className="faint small" style={{ maxWidth: 264, marginTop: 16 }}>
        A browser window opens for a magic-link sign-in. Your password never
        touches this app — it receives only a signed session.
      </p>
    </div>
  );
}
