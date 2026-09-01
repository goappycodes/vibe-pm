import { useEffect, useState } from "react";
import { Coffee, Play } from "lucide-react";
import { useStore } from "../lib/store";
import { fmtElapsed } from "../lib/time";
import { BREAK_LABEL } from "../lib/types";

export function BreakView() {
  const brk = useStore((s) => s.brk);
  const endBreak = useStore((s) => s.endBreak);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!brk) return null;
  const elapsed = Math.max(0, Math.floor((now - brk.startedAt) / 1000));

  return (
    <div className="screen">
      <div className="timerwrap">
        <div
          className="dot"
          style={{
            width: 46,
            height: 46,
            background: "rgba(245,158,11,.16)",
            color: "var(--amber)",
          }}
        >
          <Coffee className="pulse" style={{ width: 24, height: 24 }} />
        </div>
        <div className="now-label" style={{ marginTop: 12 }}>
          On a break
        </div>
        <div className="now-task">{BREAK_LABEL[brk.type]}</div>
        <div className="clock break">{fmtElapsed(elapsed)}</div>
      </div>

      <div className="actions">
        <button
          className="btn btn-primary btn-lg btn-block"
          onClick={() => endBreak()}
        >
          <Play className="icon" fill="currentColor" /> End break &amp; pick a task
        </button>
        <p className="faint small" style={{ textAlign: "center" }}>
          Break time is recorded separately — it won’t count as work.
        </p>
      </div>
    </div>
  );
}
