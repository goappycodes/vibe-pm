import { useEffect, useState } from "react";
import { Square, Timer } from "lucide-react";
import { fmtElapsed } from "./lib/time";

interface TimerState {
  mode: "timer" | "break" | "idle" | "inactive" | "off";
  label: string;
  taskTitle?: string;
  breakType?: string;
  startedAt?: number;
}

export function MiniApp() {
  const [state, setState] = useState<TimerState>({ mode: "idle", label: "" });
  const [, force] = useState(0);

  useEffect(() => {
    window.api?.miniReady?.();
    const off = window.api?.onTimerState?.((s) => setState(s));
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => {
      off?.();
      clearInterval(id);
    };
  }, []);

  const running = state.mode === "timer";
  const onBreak = state.mode === "break";
  const elapsed = state.startedAt
    ? Math.max(0, Math.floor((Date.now() - state.startedAt) / 1000))
    : 0;

  const primary = running
    ? state.taskTitle ?? "Task"
    : onBreak
      ? state.breakType ?? "Break"
      : "Pick a task";

  return (
    <div
      className={`mini ${onBreak ? "mini-break" : running ? "mini-run" : "mini-idle"}`}
      onDoubleClick={() => window.api?.miniCommand?.("open")}
    >
      <span className="mini-dot">
        <Timer style={{ width: 12, height: 12 }} />
      </span>
      <button
        className="mini-main"
        onClick={() => window.api?.miniCommand?.("open")}
        title="Open Vibe Timer"
      >
        <span className="mini-clock">
          {running || onBreak ? fmtElapsed(elapsed) : "—"}
        </span>
        <span className="mini-label">{primary}</span>
      </button>
      {running && (
        <button
          className="mini-stop"
          onClick={() => window.api?.miniCommand?.("stop")}
          title="Stop & log"
        >
          <Square style={{ width: 11, height: 11 }} fill="currentColor" />
        </button>
      )}
    </div>
  );
}
