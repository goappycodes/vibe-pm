"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Null when env isn't configured (e.g. before Vercel env vars are set) — the
// store then falls back to the bundled JSON so the app still works.
export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;

// Whether login is required (a backend is configured). Without a backend the
// app runs open on bundled demo data.
export const authRequired = !!supabase;
export const hasSupabase = !!supabase;
