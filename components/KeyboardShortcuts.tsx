"use client";

import { useStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const NAV: Record<string, string> = {
  h: "/my-day",
  t: "/table",
  b: "/board",
  l: "/timeline",
  p: "/projects",
  c: "/clients",
  m: "/team",
  v: "/velocity",
  s: "/settings",
};

const HELP: { keys: string[]; label: string }[] = [
  { keys: ["g", "h"], label: "Go to My Day" },
  { keys: ["g", "t"], label: "Go to Table" },
  { keys: ["g", "b"], label: "Go to Board" },
  { keys: ["g", "l"], label: "Go to Timeline" },
  { keys: ["g", "p"], label: "Go to Projects" },
  { keys: ["g", "m"], label: "Go to Team" },
  { keys: ["g", "v"], label: "Go to Velocity" },
  { keys: ["c"], label: "Create a new task" },
  { keys: ["/"], label: "Search (command palette)" },
  { keys: ["⌘", "K"], label: "Command palette" },
  { keys: ["?"], label: "Toggle this help" },
  { keys: ["Esc"], label: "Close panel / drawer" },
];

export function KeyboardShortcuts() {
  const router = useRouter();
  const addTask = useStore((s) => s.addTask);
  const openDetail = useStore((s) => s.openDetail);
  const setCommandOpen = useStore((s) => s.setCommandOpen);
  const [helpOpen, setHelpOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pendingG = useRef(false);
  const gTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const editable =
        !!el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.isContentEditable);

      if (e.key === "Escape") {
        if (helpOpen) setHelpOpen(false);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || editable) return;

      if (e.key === "?") {
        e.preventDefault();
        setHelpOpen((v) => !v);
        return;
      }

      if (pendingG.current) {
        pendingG.current = false;
        if (gTimer.current) clearTimeout(gTimer.current);
        const dest = NAV[e.key.toLowerCase()];
        if (dest) {
          e.preventDefault();
          router.push(dest);
          return;
        }
      }

      if (e.key === "g") {
        pendingG.current = true;
        if (gTimer.current) clearTimeout(gTimer.current);
        gTimer.current = setTimeout(() => {
          pendingG.current = false;
        }, 1200);
        return;
      }

      if (e.key === "c") {
        e.preventDefault();
        const id = addTask({ title: "Untitled task" });
        openDetail(id);
        return;
      }

      if (e.key === "/") {
        e.preventDefault();
        setCommandOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [router, addTask, openDetail, setCommandOpen, helpOpen]);

  if (!helpOpen || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-fade-in"
      onClick={() => setHelpOpen(false)}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-surface shadow-pop animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-border px-5 py-3 text-sm font-semibold text-fg">
          Keyboard shortcuts
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {HELP.map((h) => (
            <div
              key={h.label}
              className="flex items-center justify-between rounded-lg px-3 py-1.5 text-sm"
            >
              <span className="text-muted">{h.label}</span>
              <span className="flex items-center gap-1">
                {h.keys.map((k, i) => (
                  <kbd key={i} className="kbd">
                    {k}
                  </kbd>
                ))}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
