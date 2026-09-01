import { useEffect, useState } from "react";
import { Coffee, RefreshCw, Square } from "lucide-react";
import { useStore } from "../lib/store";
import { fmtElapsed } from "../lib/time";
import { BREAK_LABEL, type BreakType } from "../lib/types";

const BREAK_TYPES: BreakType[] = ["short", "lunch", "other"];

export function TimerView() {
  const timer = useStore((s) => s.timer);
  const task = useStore((s) => s.taskById(s.timer?.taskId));
  const project = useStore((s) =>
    task ? s.projectsById[task.project_id] : undefined
  );
  const stopTimer = useStore((s) => s.stopTimer);
  const switchTask = useStore((s) => s.switchTask);
  const startBreak = useStore((s) => s.startBreak);

  const [now, setNow] = useState(() => Date.now());
  const [choosing, setChoosing] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!timer) return null;
  const elapsed = Math.max(0, Math.floor((now - timer.startedAt) / 1000));

  return (
    <div className="screen">
      <div className="timerwrap">
        <div className="now-label">Working on</div>
        <div className="now-task">{task?.title ?? "Task"}</div>
        {project && <div className="faint small">{project.name}</div>}
        <div className="clock">{fmtElapsed(elapsed)}</div>
      </div>

      {choosing ? (
        <div className="actions">
          <div className="section-label" style={{ textAlign: "center" }}>
            Start a break
          </div>
          <div className="chooser">
            {BREAK_TYPES.map((t) => (
              <button
                key={t}
                className="btn btn-block"
                onClick={() => startBreak(t)}
              >
                {BREAK_LABEL[t]}
              </button>
            ))}
            <button
              className="btn btn-ghost btn-block"
              onClick={() => setChoosing(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="actions">
          <button
            className="btn btn-primary btn-lg btn-block"
            onClick={() => stopTimer()}
          >
            <Square className="icon" fill="currentColor" /> Stop &amp; log
          </button>
          <div className="row">
            <button className="btn" onClick={() => switchTask()}>
              <RefreshCw className="icon" /> Switch task
            </button>
            <button className="btn" onClick={() => setChoosing(true)}>
              <Coffee className="icon" /> Break
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
