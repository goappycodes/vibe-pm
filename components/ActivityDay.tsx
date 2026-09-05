"use client";

import { useStore } from "@/lib/store";
import { supabase } from "@/lib/supabase/client";
import type { Break, TimeLog } from "@/lib/types";
import { cn, formatDuration } from "@/lib/utils";
import {
  activeMinutesInWindow,
  addMinutesClock,
  dayOverLogged,
  entryOverLogged,
} from "@/lib/activity";
import {
  Activity,
  AlertTriangle,
  Coffee,
  Clock,
  Loader2,
  MousePointerClick,
  Moon,
  Scissors,
} from "lucide-react";
import { useMemo, useState } from "react";

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
  reviewerId,
  onChanged,
}: {
  logs: TimeLog[];
  breaks: Break[];
  activity: ActivitySampleRow[];
  // When set (admin/lead viewing), suspicious logs can be corrected in place.
  reviewerId?: string;
  onChanged?: () => void;
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

  // ---- over-logged detection (a timer likely left running with no input) ----
  const dayFlagged = dayOverLogged(loggedMin, activeMin, breakMin);
  const flagged = useMemo(() => {
    const out = new Map<string, number>(); // logId -> active minutes in its window
    for (const l of logs) {
      const am = activeMinutesInWindow(activity, l.start_time, l.end_time);
      if (entryOverLogged(l.minutes, am)) out.set(l.id, am);
    }
    return out;
  }, [logs, activity]);
  const flaggedLogs = logs
    .filter((l) => flagged.has(l.id))
    .sort((a, b) => b.minutes - a.minutes);

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

      {dayFlagged && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-500/30 dark:bg-amber-500/10">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="text-amber-800 dark:text-amber-200">
            <span className="font-medium">
              Logged time far exceeds recorded activity.
            </span>{" "}
            {formatDuration(loggedMin)} logged but only{" "}
            {formatDuration(activeMin)} active
            {breakMin > 0 && <> + {formatDuration(breakMin)} on break</>} — a
            timer may have been left running. Review the flagged entries below.
          </div>
        </div>
      )}

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
          {flaggedLogs.length > 0 && (
            <FlaggedLogs
              logs={flaggedLogs}
              activeMinById={flagged}
              taskTitle={taskTitle}
              reviewerId={reviewerId}
              onChanged={onChanged}
            />
          )}
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
                    l.modified && "ring-1 ring-inset ring-white/80",
                    flagged.has(l.id) && "ring-2 ring-inset ring-amber-400"
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

function FlaggedLogs({
  logs,
  activeMinById,
  taskTitle,
  reviewerId,
  onChanged,
}: {
  logs: TimeLog[];
  activeMinById: Map<string, number>;
  taskTitle: (id: string | null) => string;
  reviewerId?: string;
  onChanged?: () => void;
}) {
  return (
    <div className="card border-amber-300 p-4 dark:border-amber-500/30">
      <div className="mb-1 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <h3 className="text-sm font-semibold text-fg">Flagged entries</h3>
        <span className="text-xs text-faint">{logs.length}</span>
      </div>
      <p className="mb-3 text-xs text-faint">
        These logs are long but saw little computer activity in their window.
        {reviewerId ? " Trim them to the active time or set a corrected value." : ""}
      </p>
      <div className="space-y-2">
        {logs.map((l) => (
          <FlaggedRow
            key={l.id}
            log={l}
            activeMin={activeMinById.get(l.id) ?? 0}
            title={taskTitle(l.task_id)}
            reviewerId={reviewerId}
            onChanged={onChanged}
          />
        ))}
      </div>
    </div>
  );
}

function FlaggedRow({
  log,
  activeMin,
  title,
  reviewerId,
  onChanged,
}: {
  log: TimeLog;
  activeMin: number;
  title: string;
  reviewerId?: string;
  onChanged?: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [mins, setMins] = useState(String(Math.max(1, activeMin)));
  const canEdit = !!reviewerId && !!supabase;

  const apply = async (newMin: number) => {
    if (!canEdit || saving) return;
    const m = Math.max(1, Math.round(newMin));
    setSaving(true);
    const { error } = await supabase!
      .from("time_logs")
      .update({
        minutes: m,
        end_time: addMinutesClock(log.start_time, m),
        modified: true,
        edited_by: reviewerId,
        edited_at: new Date().toISOString(),
      })
      .eq("id", log.id);
    setSaving(false);
    if (error) {
      console.error("[time_logs] correct:", error.message);
      return;
    }
    setEditing(false);
    onChanged?.();
  };

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg">
          {title}
        </span>
        <span className="tabular-nums text-xs text-faint">
          {log.start_time}–{log.end_time}
        </span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="text-muted">
          Logged{" "}
          <b className="font-semibold text-fg">{formatDuration(log.minutes)}</b>
        </span>
        <span className="text-muted">
          Active{" "}
          <b className="font-semibold text-emerald-600">
            {formatDuration(activeMin)}
          </b>
        </span>
        {log.modified && <span className="text-faint">✎ edited</span>}
      </div>
      {canEdit && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            className="btn-outline gap-1.5 text-xs"
            onClick={() => apply(activeMin)}
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Scissors className="h-3.5 w-3.5" />
            )}
            Trim to {formatDuration(Math.max(1, activeMin))}
          </button>
          {editing ? (
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={1}
                value={mins}
                onChange={(e) => setMins(e.target.value)}
                className="input h-8 w-20 py-1 text-xs"
              />
              <span className="text-xs text-faint">min</span>
              <button
                className="btn-primary text-xs"
                onClick={() => apply(Number(mins) || 1)}
                disabled={saving}
              >
                Save
              </button>
              <button
                className="btn-ghost text-xs"
                onClick={() => setEditing(false)}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              className="btn-ghost text-xs"
              onClick={() => setEditing(true)}
            >
              Adjust…
            </button>
          )}
        </div>
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
