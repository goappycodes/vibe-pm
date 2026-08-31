"use client";

import { useStore } from "@/lib/store";
import { Play, Square, Timer, X } from "lucide-react";
import { useEffect, useState } from "react";

function fmtElapsed(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Start/Stop control for a specific task (used in the task drawer). */
export function TaskTimerButton({ taskId }: { taskId: string }) {
  const running = useStore((s) => s.runningTimer);
  const startTimer = useStore((s) => s.startTimer);
  const stopTimer = useStore((s) => s.stopTimer);
  const isThis = running?.taskId === taskId;

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!isThis) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isThis, running?.startedAt]);

  if (isThis && running) {
    const elapsed = Math.max(0, Math.floor((now - running.startedAt) / 1000));
    return (
      <button
        onClick={stopTimer}
        className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-emerald-700"
        title="Stop and log this time"
      >
        <Square className="h-3 w-3 fill-current" />
        Stop · <span className="tabular-nums">{fmtElapsed(elapsed)}</span>
      </button>
    );
  }
  return (
    <button
      onClick={() => startTimer(taskId)}
      className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:border-emerald-500 hover:text-emerald-600"
      title="Start a timer on this task"
    >
      <Play className="h-3 w-3 fill-current" />
      Start timer
    </button>
  );
}

/**
 * A floating, always-visible pill for the running timer — start it from a task,
 * stop it from anywhere. Stopping writes a time_log for today.
 */
export function TimerBar() {
  const timer = useStore((s) => s.runningTimer);
  const title = useStore(
    (s) => s.tasks.find((t) => t.id === s.runningTimer?.taskId)?.title
  );
  const stopTimer = useStore((s) => s.stopTimer);
  const cancelTimer = useStore((s) => s.cancelTimer);
  const openDetail = useStore((s) => s.openDetail);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!timer) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [timer]);

  if (!timer) return null;
  const elapsed = Math.max(0, Math.floor((now - timer.startedAt) / 1000));

  return (
    <div className="fixed bottom-4 left-1/2 z-[80] flex -translate-x-1/2 items-center gap-2.5 rounded-full border border-border bg-surface px-3 py-2 shadow-pop">
      <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
        <Timer className="h-4 w-4 animate-pulse" />
      </span>
      <button
        onClick={() => openDetail(timer.taskId)}
        className="max-w-[38vw] truncate text-sm font-medium text-fg hover:underline sm:max-w-xs"
        title={title ?? "Task"}
      >
        {title ?? "Task"}
      </button>
      <span className="min-w-[3.5rem] text-center text-sm font-semibold tabular-nums text-fg">
        {fmtElapsed(elapsed)}
      </span>
      <button
        onClick={stopTimer}
        className="flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-emerald-700"
        title="Stop and log this time"
      >
        <Square className="h-3 w-3 fill-current" />
        Stop
      </button>
      <button
        onClick={cancelTimer}
        className="text-faint transition-colors hover:text-rose-600"
        title="Discard without logging"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
