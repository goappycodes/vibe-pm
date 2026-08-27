"use client";

import { useStore } from "@/lib/store";
import { authRequired, supabase } from "@/lib/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CommandPalette } from "./CommandPalette";
import { DayPlanBanner } from "./DayPlanBanner";
import { KeyboardShortcuts } from "./KeyboardShortcuts";
import { LoginPage } from "./LoginPage";
import { PageSkeleton } from "./Skeleton";
import { Sidebar } from "./Sidebar";
import { TaskDetailDrawer } from "./TaskDetailDrawer";
import { Topbar } from "./Topbar";

type Theme = "light" | "dark";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const setCommandOpen = useStore((s) => s.setCommandOpen);
  const detailTaskId = useStore((s) => s.detailTaskId);
  const openDetail = useStore((s) => s.openDetail);
  const closeDetail = useStore((s) => s.closeDetail);
  const hydrate = useStore((s) => s.hydrate);
  const subscribeRealtime = useStore((s) => s.subscribeRealtime);
  const loaded = useStore((s) => s.loaded);
  const setCurrentUserByEmail = useStore((s) => s.setCurrentUserByEmail);

  // undefined = still checking; null = no session; Session = signed in.
  const [session, setSession] = useState<Session | null | undefined>(
    authRequired ? undefined : null
  );
  const authed = !authRequired || !!session;

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) =>
      setSession(s)
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  // Reconcile with Supabase once signed in, then go live over realtime.
  useEffect(() => {
    if (!authed) return;
    hydrate();
    const unsubscribe = subscribeRealtime();
    return unsubscribe;
  }, [authed, hydrate, subscribeRealtime]);

  // Point "current user" at the member whose email matches the session.
  useEffect(() => {
    const email = session?.user?.email;
    if (email && loaded) setCurrentUserByEmail(email);
  }, [session, loaded, setCurrentUserByEmail]);

  useEffect(() => {
    const stored = (localStorage.getItem("vibe-theme") as Theme | null) ?? null;
    const initial: Theme =
      stored ??
      (window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light");
    setTheme(initial);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("vibe-theme", theme);
  }, [theme]);

  const toggleTheme = () =>
    setTheme((t) => (t === "dark" ? "light" : "dark"));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [setCommandOpen]);

  // Sync the open task with the URL (?task=<id>) so details are deep-linkable
  // and the back button closes the drawer.
  useEffect(() => {
    const applyFromUrl = () => {
      const id = new URLSearchParams(window.location.search).get("task");
      const state = useStore.getState();
      if (id && state.tasks.some((t) => t.id === id)) {
        if (state.detailTaskId !== id) openDetail(id);
      } else if (state.detailTaskId) {
        closeDetail();
      }
    };
    applyFromUrl();
    window.addEventListener("popstate", applyFromUrl);
    return () => window.removeEventListener("popstate", applyFromUrl);
  }, [openDetail, closeDetail]);

  // A deep-linked ?task= may be a DB-only task not present in the bundled data
  // the first sync ran against — re-open it once hydration lands.
  useEffect(() => {
    if (!loaded) return;
    const id = new URLSearchParams(window.location.search).get("task");
    const state = useStore.getState();
    if (id && !state.detailTaskId && state.tasks.some((t) => t.id === id)) {
      openDetail(id);
    }
  }, [loaded, openDetail]);

  const wasOpen = useRef(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const current = params.get("task");
    if (detailTaskId) {
      wasOpen.current = true;
      if (detailTaskId !== current) {
        params.set("task", detailTaskId);
        window.history.pushState(
          null,
          "",
          `${window.location.pathname}?${params.toString()}`
        );
      }
    } else if (wasOpen.current && current) {
      // Only clear the param on a genuine close, never on the initial mount
      // (which would strip a deep-linked ?task= before it opens).
      params.delete("task");
      const qs = params.toString();
      window.history.pushState(
        null,
        "",
        window.location.pathname + (qs ? `?${qs}` : "")
      );
    }
  }, [detailTaskId]);

  if (authRequired && session === undefined) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg">
        <Loader2 className="h-6 w-6 animate-spin text-faint" />
      </div>
    );
  }
  if (authRequired && !session) {
    return <LoginPage />;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        theme={theme}
        toggleTheme={toggleTheme}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenu={() => setSidebarOpen(true)} />
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {loaded ? (
            <>
              <DayPlanBanner />
              <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
            </>
          ) : (
            <PageSkeleton />
          )}
        </main>
      </div>
      <CommandPalette />
      <KeyboardShortcuts />
      <TaskDetailDrawer />
    </div>
  );
}
