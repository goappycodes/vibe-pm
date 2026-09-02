import { useEffect, useRef, useState } from "react";
import {
  Check,
  CheckCircle2,
  Coffee,
  Loader2,
  MessageSquarePlus,
  RefreshCw,
  Square,
} from "lucide-react";
import { useStore } from "../lib/store";
import { fmtElapsed } from "../lib/time";
import {
  BREAK_LABEL,
  STATUS_DOT,
  STATUS_LABEL,
  STATUS_ORDER,
  type BreakType,
  type Status,
} from "../lib/types";

const BREAK_TYPES: BreakType[] = ["short", "lunch", "other"];

function CommentBox({ taskId }: { taskId: string }) {
  const addComment = useStore((s) => s.addComment);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const submit = async () => {
    const body = text.trim();
    if (!body || saving) return;
    setSaving(true);
    const ok = await addComment(taskId, body);
    setSaving(false);
    if (ok) {
      setText("");
      setSaved(true);
      setOpen(false);
      setTimeout(() => setSaved(false), 2500);
    }
  };

  if (!open) {
    return (
      <button className="btn btn-ghost btn-block" onClick={() => setOpen(true)}>
        {saved ? (
          <>
            <Check className="icon" style={{ color: "var(--accent)" }} /> Comment
            added
          </>
        ) : (
          <>
            <MessageSquarePlus className="icon" /> Add a comment
          </>
        )}
      </button>
    );
  }

  return (
    <div className="comment-box">
      <input
        ref={inputRef}
        className="input"
        placeholder="Add a comment on this task…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") setOpen(false);
        }}
      />
      <div className="row" style={{ marginTop: 8 }}>
        <button
          className="btn btn-ghost"
          onClick={() => {
            setOpen(false);
            setText("");
          }}
        >
          Cancel
        </button>
        <button
          className="btn btn-primary"
          onClick={submit}
          disabled={!text.trim() || saving}
        >
          {saving ? <Loader2 className="icon spin" /> : "Post"}
        </button>
      </div>
    </div>
  );
}

export function TimerView() {
  const timer = useStore((s) => s.timer);
  const task = useStore((s) => s.taskById(s.timer?.taskId));
  const project = useStore((s) =>
    task ? s.projectsById[task.project_id] : undefined
  );
  const stopTimer = useStore((s) => s.stopTimer);
  const switchTask = useStore((s) => s.switchTask);
  const startBreak = useStore((s) => s.startBreak);
  const setTaskStatus = useStore((s) => s.setTaskStatus);

  const [now, setNow] = useState(() => Date.now());
  const [choosing, setChoosing] = useState(false);
  const [choosingStatus, setChoosingStatus] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!timer) return null;
  const elapsed = Math.max(0, Math.floor((now - timer.startedAt) / 1000));

  const changeStatus = (s: Status) => {
    const id = timer.taskId;
    setChoosingStatus(false);
    if (s === "done") {
      // Completing the task logs the work and returns to the picker.
      stopTimer();
      void setTaskStatus(id, "done");
    } else {
      void setTaskStatus(id, s);
    }
  };

  return (
    <div className="screen">
      <div className="timerwrap">
        <div className="now-label">Working on</div>
        <div className="now-task">{task?.title ?? "Task"}</div>
        {project && <div className="faint small">{project.name}</div>}
        {task && (
          <button
            className="status-chip"
            onClick={() => {
              setChoosing(false);
              setChoosingStatus(true);
            }}
            title="Change status"
          >
            <span
              className="sdot"
              style={{ background: STATUS_DOT[task.status] }}
            />
            {STATUS_LABEL[task.status]}
          </button>
        )}
        <div className="clock">{fmtElapsed(elapsed)}</div>
      </div>

      {choosingStatus ? (
        <div className="actions">
          <div className="section-label" style={{ textAlign: "center" }}>
            Set status
          </div>
          <div className="chooser">
            {STATUS_ORDER.map((s) =>
              s === "done" ? (
                <button
                  key={s}
                  className="btn btn-primary btn-block"
                  onClick={() => changeStatus(s)}
                >
                  <CheckCircle2 className="icon" /> Complete &amp; stop
                </button>
              ) : (
                <button
                  key={s}
                  className="btn btn-block"
                  onClick={() => changeStatus(s)}
                  disabled={task?.status === s}
                >
                  <span className="sdot" style={{ background: STATUS_DOT[s] }} />
                  {STATUS_LABEL[s]}
                  {task?.status === s && (
                    <Check className="icon" style={{ marginLeft: "auto" }} />
                  )}
                </button>
              )
            )}
            <button
              className="btn btn-ghost btn-block"
              onClick={() => setChoosingStatus(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : choosing ? (
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
          <button
            className="btn btn-done btn-block"
            onClick={() => changeStatus("done")}
          >
            <CheckCircle2 className="icon" /> Mark complete
          </button>
          <CommentBox taskId={timer.taskId} />
        </div>
      )}
    </div>
  );
}
