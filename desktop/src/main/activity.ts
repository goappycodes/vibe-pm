import { powerMonitor } from "electron";
import type { ActivitySample } from "../preload/index";

const SAMPLE_MS = 15_000; // check input activity every 15s
const ACTIVE_IF_IDLE_UNDER = 45; // seconds since last input to still count as active

export interface ActivityContext {
  mode: "timer" | "break" | "idle" | "inactive";
  taskId: string | null;
}

let timer: ReturnType<typeof setInterval> | null = null;
let curKey = ""; // `${date} ${minute}`
let curDate = "";
let curMinute = "";
let activeSeconds = 0;

function localParts(d: Date): { date: string; minute: string } {
  const p = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`,
    minute: `${p(d.getHours())}:${p(d.getMinutes())}`,
  };
}

/**
 * Samples OS input activity on an interval and reports a per-minute bucket
 * (active seconds + the current task / break) via `flush`. Uses real wall-clock
 * time so the activity dashboard reflects actual days.
 */
export function startActivityTracking(
  getContext: () => ActivityContext,
  flush: (sample: ActivitySample) => void
): void {
  if (timer) return;

  const tick = () => {
    const ctx = getContext();
    if (ctx.mode === "inactive") return; // signed out — don't track

    const { date, minute } = localParts(new Date());
    const key = `${date} ${minute}`;
    if (key !== curKey) {
      curKey = key;
      curDate = date;
      curMinute = minute;
      activeSeconds = 0;
    }

    const idle = powerMonitor.getSystemIdleTime();
    if (idle < ACTIVE_IF_IDLE_UNDER) {
      activeSeconds = Math.min(60, activeSeconds + SAMPLE_MS / 1000);
    }

    flush({
      date: curDate,
      minute: curMinute,
      activeSeconds,
      taskId: ctx.taskId,
      onBreak: ctx.mode === "break",
    });
  };

  timer = setInterval(tick, SAMPLE_MS);
  tick();
}

export function stopActivityTracking(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
