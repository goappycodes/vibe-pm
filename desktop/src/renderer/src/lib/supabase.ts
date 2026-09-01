import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Surfaced in the UI too, but make it loud in the console during dev.
  console.error(
    "[supabase] Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env."
  );
}

export const hasConfig = !!(url && anonKey);

// createClient throws synchronously on an empty/invalid URL, which would
// white-screen the renderer at import time. When config is missing we hand it
// a syntactically-valid placeholder so the module loads; the store checks
// hasConfig first and never actually calls this client in that case.
export const supabase = createClient(
  url || "https://placeholder.supabase.co",
  anonKey || "placeholder-anon-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // The desktop app receives its session over IPC, not from the page URL.
      detectSessionInUrl: false,
    },
  }
);
