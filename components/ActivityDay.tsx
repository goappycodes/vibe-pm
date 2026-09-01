"use client";

import { useStore } from "@/lib/store";
import type { Break, TimeLog } from "@/lib/types";
import { cn, formatDuration } from "@/lib/utils";
import { Activity, Coffee, Clock, MousePointerClick, Moon } from "lucide-react";
import { useMemo } from "react";

export interface ActivitySampleRow {
  minute: string; // "HH:MM"
  active_seconds: number;
  task_id: string | null;
  on_break: boolean;
}

const PROJECT_HEX: Record<string, string> = {
  indigo: "#6366f1",
  emerald: "#10b981",
  amber: "#f59e0b",
  rose: "#f43f5e",
  sky: "#0ea5e9",
};

const toMin = (s: string): number => {
  const [h, m] = s.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
const hourLabel = (min: number): string => {
  const h = Math.floor(min / 60) % 24;
  const ampm = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${ampm}`;
};

export function ActivityDay({
  logs,
  breaks,
  activity,
}: {
  logs: TimeLog[];
  breaks: Break[];
  activity: ActivitySampleRow[];
}) {
  const tasks = useStore((s) => s.tasks);
  const projectById = useStore((s) => s.projectById);

  const taskColor = (taskId: string | null): string => {
    const t = tasks.find((x) => x.id === taskId);
    const color = t ? projectById(t.project_id)?.color : undefined;
    return PROJECT_HEX[color ?? ""] ?? "#64748b";
  };
  const taskTitle = (taskId: string | null): string =>
    tasks.find((x) => x.id === taskId)?.title ?? "Untitled task";

  // ---- totals ----
  const loggedMin = logs.reduce((s, l) => s + l.minutes, 0);
  const breakMin = breaks.reduce((s, b) => s + b.minutes, 0);
  const activeMin = Math.round(
    activity.reduce((s, a) => s + a.active_seconds, 0) / 60
  );
  const idleMin = Math.round(
    activity
      .filter((a) => !a.on_break)
      .reduce((s, a) => s + (60 - a.active_seconds), 0) / 60
  );

  // ---- per-task breakdown (from logged time) ----
  const perTask = useMemo(() => {
    const map = new Map<string | null, number>();
    for (const l of logs) map.set(l.task_id, (map.get(l.task_id) ?? 0) + l.minutes);
    return Array.from(map.entries())
      .map(([taskId, minutes]) => ({ taskId, minutes }))
      .sort((a, b) => b.minutes - a.minutes);
  }, [logs]);

  // ---- timeline range ----
  const points: number[] = [];
  logs.forEach((l) => points.push(toMin(l.start_time), toMin(l.end_time)));
  breaks.forEach((b) => points.push(toMin(b.start_time), toMin(b.end_time)));
  activity.forEach((a) => points.push(toMin(a.minute), toMin(a.minute) + 1));
  const hasData = points.length > 0;
  let lo = hasData ? Math.min(...points) : 9 * 60;
  let hi = hasData ? Math.max(...points) : 18 * 60;
  lo = Math.floor(lo / 60) * 60;
  hi = Math.ceil(hi / 60) * 60;
  if (hi - lo < 60) hi = lo + 60;
  const span = hi - lo;
  const pct = (m: number) => ((m - lo) / span) * 100;

  const hourTicks: number[] = [];
  for (let h = lo; h <= hi; h += 60) hourTicks.push(h);

  return (
    <div className="space-y-6">
      {/* stat tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile icon={<Clock className="h-4 w-4" />} label="Logged" value={formatDuration(loggedMin)} tone="indigo" />
        <StatTile icon={<MousePointerClick className="h-4 w-4" />} label="Active" value={formatDuration(activeMin)} tone="emerald" />
        <StatTile icon={<Moon className="h-4 w-4" />} label="Idle" value={formatDuration(idleMin)} tone="slate" />
        <StatTile icon={<Coffee className="h-4 w-4" />} label="Break" value={formatDuration(breakMin)} tone="amber" />
      </div>

      {!hasData ? (
        <div className="rounded-2xl border border-dashed border-border py-16 text-center">
          <Activity className="mx-auto h-8 w-8 text-faint" />
          <p className="mt-2 text-sm font-medium text-fg">No activity this day</p>
          <p className="text-xs text-faint">
            Time logs, breaks, and computer activity will show here once tracked.
          </p>
        </div>
      ) : (
        <>
          {/* timeline */}
          <div className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-fg">Day timeline</h3>
              <Legend />
            </div>

            {/* hour axis */}
            <div className="relative mb-1 h-4">
              {hourTicks.map((h) => (
                <span
                  key={h}
                  className="absolute -translate-x-1/2 text-[10px] text-faint"
                  style={{ left: `${pct(h)}%` }}
                >
                  {hourLabel(h)}
                </span>
              ))}
            </div>

            {/* tracked track: tasks + breaks */}
            <TrackLabel>Tracked</TrackLabel>
            <div className="relative mb-3 h-7 rounded-md bg-surface-2">
              {hourTicks.map((h) => (
                <span
                  key={h}
                  className="absolute top-0 h-full w-px bg-border/70"
                  style={{ left: `${pct(h)}%` }}
                />
              ))}
              {logs.map((l) => (
                <div
                  key={l.id}
                  className={cn(
                    "absolute top-1 flex h-5 items-center overflow-hidden rounded px-1.5 text-[10px] font-medium text-white",
                    l.modified && "ring-1 ring-inset ring-white/80"
                  )}
                  style={{
                    left: `${pct(toMin(l.start_time))}%`,
                    width: `${Math.max(0.6, pct(toMin(l.end_time)) - pct(toMin(l.start_time)))}%`,
                    background: taskColor(l.task_id),
                  }}
                  title={`${taskTitle(l.task_id)} · ${l.start_time}–${l.end_time} · ${formatDuration(l.minutes)}${l.modified ? " · edited" : ""}`}
                >
                  <span className="truncate">
                    {l.modified ? "✎ " : ""}
                    {taskTitle(l.task_id)}
                  </span>
                </div>
              ))}
              {breaks.map((b) => (
                <div
                  key={b.id}
                  className="absolute top-1 h-5 rounded bg-amber-400/80 dark:bg-amber-500/70"
                  style={{
                    left: `${pct(toMin(b.start_time))}%`,
                    width: `${Math.max(0.6, pct(toMin(b.end_time)) - pct(toMin(b.start_time)))}%`,
                  }}
                  title={`Break · ${b.start_time}–${b.end_time} · ${formatDuration(b.minutes)}`}
                />
              ))}
            </div>

            {/* computer activity strip */}
            <TrackLabel>Computer</TrackLabel>
            <div className="relative h-7 overflow-hidden rounded-md bg-surface-2">
              {hourTicks.map((h) => (
                <span
                  key={h}
                  className="absolute top-0 h-full w-px bg-border/70"
                  style={{ left: `${pct(h)}%` }}
                />
              ))}
              {activity.map((a) => {
                const m = toMin(a.minute);
                const ratio = Math.max(0, Math.min(1, a.active_seconds / 60));
                const color = a.on_break
                  ? "rgba(245,158,11,0.75)"
                  : ratio >= 0.5
                    ? `rgba(16,185,129,${0.35 + 0.55 * ratio})`
                    : "rgba(100,116,139,0.5)";
                return (
                  <span
                    key={a.minute}
                    className="absolute top-1 h-5"
                    style={{
                      left: `${pct(m)}%`,
                      width: `${Math.max(0.25, pct(m + 1) - pct(m))}%`,
                      background: color,
                    }}
                    title={`${a.minute} · ${a.on_break ? "on break" : `${a.active_seconds}s active`}`}
                  />
                );
              })}
            </div>
          </div>

          {/* per-task breakdown */}
          {perTask.length > 0 && (
            <div className="card p-4">
              <h3 className="mb-3 text-sm font-semibold text-fg">
                Logged time by task
              </h3>
              <div className="space-y-2">
                {perTask.map(({ taskId, minutes }) => (
                  <div key={taskId ?? "none"} className="flex items-center gap-3">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: taskColor(taskId) }}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm text-fg">
                      {taskTitle(taskId)}
                    </span>
                    <div className="hidden h-1.5 w-40 overflow-hidden rounded-full bg-surface-2 sm:block">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${loggedMin ? (minutes / loggedMin) * 100 : 0}%`,
                          background: taskColor(taskId),
                        }}
                      />
                    </div>
                    <span className="w-16 text-right text-sm font-medium tabular-nums text-muted">
                      {formatDuration(minutes)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TrackLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-faint">
      {children}
    </div>
  );
}

function Legend() {
  const item = (color: string, label: string) => (
    <span className="flex items-center gap-1 text-[10px] text-faint">
      <span className="h-2 w-2 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
  return (
    <div className="flex items-center gap-3">
      {item("rgba(16,185,129,0.85)", "Active")}
      {item("rgba(100,116,139,0.5)", "Idle")}
      {item("rgba(245,158,11,0.8)", "Break")}
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "indigo" | "emerald" | "slate" | "amber";
}) {
  const tones = {
    indigo: "text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10",
    emerald: "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10",
    slate: "text-slate-500 bg-slate-100 dark:bg-slate-500/10",
    amber: "text-amber-600 bg-amber-50 dark:bg-amber-500/10",
  }[tone];
  return (
    <div className="card flex items-center gap-3 p-3.5">
      <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg", tones)}>
        {icon}
      </span>
      <div>
        <div className="text-lg font-semibold leading-none text-fg tabular-nums">
          {value}
        </div>
        <div className="mt-1 text-xs text-faint">{label}</div>
      </div>
    </div>
  );
}
