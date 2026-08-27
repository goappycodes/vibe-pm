"use client";

import { Avatar } from "@/components/Avatar";
import { useStore } from "@/lib/store";
import { ROLE_META, type Task, type TeamMember } from "@/lib/types";
import { addDays, cn, parseDate, TODAY } from "@/lib/utils";
import { Gauge, TrendingUp, Layers, Clock } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

const WINDOW_DAYS = 7;
const sumPts = (list: Task[]) =>
  list.reduce((a, t) => a + (t.story_points ?? 0), 0);

interface Row {
  member: TeamMember;
  allocated: number; // open (committed) points
  inProgress: number;
  completedTotal: number;
  velocity: number; // points completed in the last window (pts / week)
  weeksToClear: number | null; // allocated / velocity
  openCount: number;
  doneCount: number;
}

export default function VelocityPage() {
  const tasks = useStore((s) => s.tasks);
  const members = useStore((s) => s.members);

  const since = addDays(TODAY, -WINDOW_DAYS);

  const rows = useMemo<Row[]>(() => {
    return members
      .map((member) => {
        const mine = tasks.filter((t) => t.assignee_id === member.id);
        const open = mine.filter((t) => t.status !== "done");
        const done = mine.filter((t) => t.status === "done");
        const recent = done.filter((t) => {
          const c = parseDate(t.completed_at);
          return c ? c >= since : false;
        });
        const allocated = sumPts(open);
        const velocity = sumPts(recent);
        return {
          member,
          allocated,
          inProgress: sumPts(mine.filter((t) => t.status === "in_progress")),
          completedTotal: sumPts(done),
          velocity,
          weeksToClear:
            velocity > 0 ? allocated / velocity : allocated > 0 ? null : 0,
          openCount: open.length,
          doneCount: done.length,
        };
      })
      .filter((r) => r.allocated > 0 || r.completedTotal > 0)
      .sort((a, b) => b.velocity - a.velocity || b.allocated - a.allocated);
  }, [tasks, members, since]);

  const maxBar = Math.max(1, ...rows.map((r) => Math.max(r.velocity, r.allocated)));
  const teamVelocity = rows.reduce((a, r) => a + r.velocity, 0);
  const teamAllocated = rows.reduce((a, r) => a + r.allocated, 0);
  const hidden = members.length - rows.length;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-6 py-6">
        {/* summary */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat
            icon={<TrendingUp className="h-4 w-4" />}
            label="Team velocity"
            value={teamVelocity}
            unit="pts / wk"
            tone="emerald"
          />
          <Stat
            icon={<Layers className="h-4 w-4" />}
            label="Allocated"
            value={teamAllocated}
            unit="open pts"
            tone="indigo"
          />
          <Stat
            icon={<Gauge className="h-4 w-4" />}
            label="Contributors"
            value={rows.length}
            unit="active"
          />
          <Stat
            icon={<Clock className="h-4 w-4" />}
            label="Backlog runway"
            value={
              teamVelocity > 0
                ? Math.round((teamAllocated / teamVelocity) * 10) / 10
                : 0
            }
            unit="weeks"
            tone={
              teamVelocity > 0 && teamAllocated / teamVelocity > 2
                ? "rose"
                : undefined
            }
          />
        </div>

        {/* legend */}
        <div className="mb-2 flex items-center gap-4 px-1 text-xs text-faint">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-4 rounded-sm bg-emerald-500" />
            Velocity (done · last {WINDOW_DAYS}d)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-4 rounded-sm bg-indigo-400/70" />
            Allocated (open)
          </span>
        </div>

        {/* rows */}
        <div className="card divide-y divide-border overflow-hidden">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_64px_64px_88px] items-center gap-3 bg-surface-2/60 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-faint">
            <span>Member</span>
            <span>Throughput vs load</span>
            <span className="text-right">Vel.</span>
            <span className="text-right">Alloc.</span>
            <span className="text-right">Runway</span>
          </div>
          {rows.map((r) => (
            <VelocityRow key={r.member.id} row={r} maxBar={maxBar} />
          ))}
          {rows.length === 0 && (
            <div className="px-4 py-16 text-center text-sm text-faint">
              No assigned story points yet.
            </div>
          )}
        </div>

        {hidden > 0 && (
          <p className="mt-3 px-1 text-xs text-faint">
            {hidden} teammate{hidden === 1 ? "" : "s"} with no assigned tasks
            hidden.
          </p>
        )}
        <p className="mt-1 px-1 text-xs text-faint">
          Velocity = story points completed in the last {WINDOW_DAYS} days.
          Runway = open points ÷ velocity (how long the current load takes at
          this pace).
        </p>
      </div>
    </div>
  );
}

function VelocityRow({ row, maxBar }: { row: Row; maxBar: number }) {
  const { member } = row;
  const velPct = (row.velocity / maxBar) * 100;
  const allocPct = (row.allocated / maxBar) * 100;
  const overloaded = row.weeksToClear === null || (row.weeksToClear ?? 0) > 2;

  return (
    <Link
      href={`/member/${member.id}`}
      className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_64px_64px_88px] items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <Avatar member={member} size="sm" />
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-fg">
            {member.name}
          </div>
          <div className="text-[11px] text-faint">
            {ROLE_META[member.role].label} · {row.doneCount} done ·{" "}
            {row.openCount} open
          </div>
        </div>
      </div>

      {/* dual bar */}
      <div className="space-y-1">
        <div className="h-2 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${velPct}%` }}
          />
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-indigo-400/70 transition-all"
            style={{ width: `${allocPct}%` }}
          />
        </div>
      </div>

      <div className="text-right text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
        {row.velocity}
      </div>
      <div className="text-right text-sm tabular-nums text-fg">
        {row.allocated}
      </div>
      <div
        className={cn(
          "text-right text-sm tabular-nums",
          overloaded ? "text-rose-600 dark:text-rose-400" : "text-muted"
        )}
      >
        {row.weeksToClear === null
          ? "—"
          : row.weeksToClear === 0
            ? "clear"
            : `${Math.round(row.weeksToClear * 10) / 10}w`}
      </div>
    </Link>
  );
}

function Stat({
  icon,
  label,
  value,
  unit,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  unit: string;
  tone?: "emerald" | "indigo" | "rose";
}) {
  const tones = {
    emerald: "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10",
    indigo: "text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10",
    rose: "text-rose-600 bg-rose-50 dark:bg-rose-500/10",
  };
  return (
    <div className="card flex items-center gap-3 p-3.5">
      <span
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-lg",
          tone ? tones[tone] : "bg-surface-2 text-muted"
        )}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-xl font-semibold leading-none tabular-nums text-fg">
          {value}
        </div>
        <div className="mt-1 truncate text-xs text-faint">
          {label} · {unit}
        </div>
      </div>
    </div>
  );
}
