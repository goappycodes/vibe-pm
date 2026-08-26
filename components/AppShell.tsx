"use client";

import { useStore } from "@/lib/store";
import { useEffect, useRef, useState } from "react";
import { CommandPalette } from "./CommandPalette";
import { Sidebar } from "./Sidebar";
import { TaskDetailDrawer } from "./TaskDetailDrawer";
import { Topbar } from "./Topbar";

type Theme = "light" | "dark";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");
  const setCommandOpen = useStore((s) => s.setCommandOpen);
  const detailTaskId = useStore((s) => s.detailTaskId);
  const openDetail = useStore((s) => s.openDetail);
  const closeDetail = useStore((s) => s.closeDetail);

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

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar theme={theme} toggleTheme={toggleTheme} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
      </div>
      <CommandPalette />
      <TaskDetailDrawer />
    </div>
  );
}
