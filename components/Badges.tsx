"use client";

import {
  PROJECT_COLORS,
  STATUS_META,
  URGENCY_META,
  type Project,
  type Status,
  type Urgency,
} from "@/lib/types";
import { cn, cycleTime, relativeDue } from "@/lib/utils";
import { CalendarDays, Check } from "lucide-react";

export function StatusBadge({ status }: { status: Status }) {
  const meta = STATUS_META[status];
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span className={cn("h-2 w-2 rounded-full", meta.dot)} />
      <span className={cn("font-medium", meta.color)}>{meta.label}</span>
    </span>
  );
}

export function UrgencyBadge({ urgency }: { urgency: Urgency }) {
  const meta = URGENCY_META[urgency];
  return <span className={cn("chip", meta.className)}>{meta.label}</span>;
}

export function ProjectBadge({
  project,
  className,
}: {
  project: Project | undefined;
  className?: string;
}) {
  if (!project) return null;
  const c = PROJECT_COLORS[project.color] ?? PROJECT_COLORS.indigo;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs font-medium",
        c.soft,
        c.text,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", c.dot)} />
      {project.name}
    </span>
  );
}

/** Time-to-complete chip for done tasks (created → completed). */
export function CycleBadge({
  createdAt,
  completedAt,
}: {
  createdAt: string;
  completedAt: string | null;
}) {
  const ct = cycleTime(createdAt, completedAt);
  if (!ct) return null;
  return (
    <span
      title={`Completed in ${ct.long}`}
      className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
    >
      <Check className="h-3 w-3" />
      {ct.short}
    </span>
  );
}

export function PointsBadge({ points }: { points: number | null }) {
  if (points == null) return null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-muted"
      title={`${points} story points`}
    >
      {points}
      <span className="text-[9px] font-medium text-faint">SP</span>
    </span>
  );
}

export function DueBadge({
  date,
  icon = true,
}: {
  date: string | null;
  icon?: boolean;
}) {
  const rel = relativeDue(date);
  const tone = {
    overdue: "text-rose-600 dark:text-rose-400",
    today: "text-amber-600 dark:text-amber-400 font-semibold",
    soon: "text-fg",
    future: "text-muted",
    none: "text-faint",
  }[rel.tone];
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs", tone)}>
      {icon && <CalendarDays className="h-3.5 w-3.5" />}
      {rel.label}
    </span>
  );
}
