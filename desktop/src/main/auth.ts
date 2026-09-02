import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { shell } from "electron";

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
}

const WEB_LOGIN_URL =
  import.meta.env.MAIN_VITE_WEB_LOGIN_URL || "https://vibe-pm-six.vercel.app";

const AUTH_TIMEOUT_MS = 5 * 60 * 1000;

// Served to the browser at 127.0.0.1:<port>/callback. It reads the session
// tokens from the URL fragment (which never reaches this server as a request)
// and POSTs them back same-origin, so tokens stay out of the server's request
// line / any log.
const CALLBACK_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Vibe Timer — Signing in</title>
  <style>
    :root { color-scheme: light dark; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center;
      font: 15px/1.5 system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      background: #0b0b0f; color: #e5e7eb; }
    .card { text-align: center; max-width: 22rem; padding: 2rem 1.5rem; }
    .dot { width: 44px; height: 44px; border-radius: 999px; margin: 0 auto 1rem;
      background: #10b981; display: grid; place-items: center; color: #fff; font-size: 22px; }
    h1 { font-size: 1.1rem; margin: 0 0 .35rem; }
    p { margin: 0; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="card">
    <div class="dot">&#10003;</div>
    <h1>Signed in</h1>
    <p id="msg">Handing your session to Vibe Timer&hellip;</p>
  </div>
  <script>
    (function () {
      var p = new URLSearchParams(location.hash.replace(/^#/, ""));
      var payload = {
        access_token: p.get("access_token"),
        refresh_token: p.get("refresh_token"),
        expires_at: p.get("expires_at"),
        state: p.get("state"),
      };
      fetch("/deliver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then(function (r) {
          document.getElementById("msg").textContent = r.ok
            ? "Done — you can close this tab and return to Vibe Timer."
            : "Something went wrong. Please try signing in again.";
        })
        .catch(function () {
          document.getElementById("msg").textContent =
            "Couldn't reach the app. Is Vibe Timer still open?";
        });
    })();
  </script>
</body>
</html>`;

/**
 * Runs the desktop sign-in: spins up a one-shot loopback server, opens the
 * system browser at the web app's /desktop-auth page, and resolves with the
 * Supabase session the browser hands back. Rejects on timeout.
 */
export function startBrowserLogin(): Promise<AuthTokens> {
  return new Promise((resolve, reject) => {
    const state = randomUUID();
    let settled = false;
    const server = createServer(handle);

    const timer = setTimeout(() => {
      finish(() => reject(new Error("Sign-in timed out. Please try again.")));
    }, AUTH_TIMEOUT_MS);

    function finish(fn: () => void) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        server.close();
      } catch {
        /* already closing */
      }
      fn();
    }

    function handle(req: IncomingMessage, res: ServerResponse) {
      const url = new URL(req.url || "/", "http://127.0.0.1");

      if (req.method === "GET" && url.pathname === "/callback") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(CALLBACK_HTML);
        return;
      }

      if (req.method === "POST" && url.pathname === "/deliver") {
        let body = "";
        req.on("data", (c) => {
          body += c;
          if (body.length > 1_000_000) req.destroy(); // guard
        });
        req.on("end", () => {
          try {
            const data = JSON.parse(body || "{}") as Partial<AuthTokens> & {
              state?: string;
            };
            if (
              data.state !== state ||
              !data.access_token ||
              !data.refresh_token
            ) {
              res.writeHead(400);
              res.end("bad request");
              return;
            }
            res.writeHead(200, { "Content-Type": "text/plain" });
            res.end("ok");
            finish(() =>
              resolve({
                access_token: data.access_token!,
                refresh_token: data.refresh_token!,
                expires_at: data.expires_at
                  ? Number(data.expires_at)
                  : undefined,
              })
            );
          } catch {
            res.writeHead(400);
            res.end("bad request");
          }
        });
        return;
      }

      res.writeHead(404);
      res.end();
    }

    server.on("error", (e) => finish(() => reject(e)));
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      const base = WEB_LOGIN_URL.replace(/\/$/, "");
      const target = `${base}/desktop-auth?port=${port}&state=${state}`;
      void shell.openExternal(target);
    });
  });
}
