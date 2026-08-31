"use client";

import { useStore } from "@/lib/store";
import type { Task } from "@/lib/types";
import { STATUS_META } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useTodayPlan } from "@/lib/dayPlan";
import { Check, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { PointsBadge, ProjectBadge } from "./Badges";

/**
 * Modal for picking which existing tasks make up a day plan. Defaults to the
 * current user; admins can pass `userId` to build another member's plan.
 */
export function DayPlanPicker({
  onClose,
  userId,
}: {
  onClose: () => void;
  userId?: string;
}) {
  const tasks = useStore((s) => s.tasks);
  const projects = useStore((s) => s.projects);
  const currentUserId = useStore((s) => s.currentUserId);
  const addToDayPlan = useStore((s) => s.addToDayPlan);
  const removeFromDayPlan = useStore((s) => s.removeFromDayPlan);
  const targetUserId = userId ?? currentUserId;
  const isSelf = targetUserId === currentUserId;
  const member = useStore((s) => s.members.find((m) => m.id === targetUserId));
  const { planTasks } = useTodayPlan(targetUserId);

  const [query, setQuery] = useState("");
  const [onlyTheirs, setOnlyTheirs] = useState(true);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const firstName = member?.name.split(" ")[0] ?? "them";

  const selectedIds = useMemo(
    () => new Set(planTasks.map((t) => t.id)),
    [planTasks]
  );

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks
      .filter((t) => t.status !== "done" || selectedIds.has(t.id))
      .filter((t) => !onlyTheirs || t.assignee_id === targetUserId)
      .filter((t) => !q || t.title.toLowerCase().includes(q))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [tasks, onlyTheirs, targetUserId, query, selectedIds]);

  const toggle = (t: Task) => {
    if (selectedIds.has(t.id)) removeFromDayPlan(t.id, targetUserId);
    else addToDayPlan(t.id, targetUserId);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 p-4 pt-[8vh] backdrop-blur-sm animate-fade-in"
      onMouseDown={onClose}
    >
      <div
        className="flex max-h-[76vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-pop animate-scale-in"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div>
            <div className="text-sm font-semibold text-fg">
              {isSelf ? "Plan your day" : `Plan ${firstName}'s day`}
            </div>
            <div className="text-xs text-faint">
              {selectedIds.size} task{selectedIds.size === 1 ? "" : "s"}{" "}
              selected
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn-ghost h-8 w-8 shrink-0 p-0"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 border-b border-border px-4 py-2">
          <Search className="h-4 w-4 shrink-0 text-faint" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks…"
            className="min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-faint"
          />
          <button
            onClick={() => setOnlyTheirs((v) => !v)}
            className={cn(
              "chip shrink-0",
              onlyTheirs
                ? "border-transparent bg-accent-soft text-accent"
                : "border-border text-muted"
            )}
          >
            {onlyTheirs
              ? isSelf
                ? "Assigned to me"
                : `Assigned to ${firstName}`
              : "Everyone"}
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto py-1">
          {candidates.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-faint">
              No open tasks match.
            </div>
          )}
          {candidates.map((t) => {
            const project = projects.find((p) => p.id === t.project_id);
            const selected = selectedIds.has(t.id);
            return (
              <button
                key={t.id}
                onClick={() => toggle(t)}
                className="flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-surface-2"
              >
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                    selected
                      ? "border-accent bg-accent text-accent-fg"
                      : "border-border"
                  )}
                >
                  {selected && <Check className="h-3.5 w-3.5" />}
                </span>
                <span
                  className={cn(
                    "h-2 w-2 shrink-0 rounded-full",
                    STATUS_META[t.status].dot
                  )}
                />
                <span className="min-w-0 flex-1 truncate text-sm text-fg">
                  {t.title}
                </span>
                <ProjectBadge project={project} />
                {t.story_points != null && (
                  <PointsBadge points={t.story_points} />
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
          <button onClick={onClose} className="btn-primary">
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
