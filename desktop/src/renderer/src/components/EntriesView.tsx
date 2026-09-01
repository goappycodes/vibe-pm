import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Coffee,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { useStore } from "../lib/store";
import { fmtDate, fmtDuration } from "../lib/time";
import type { TimeEntry } from "../lib/types";

function realToday(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

type FormMode =
  | { kind: "add" }
  | { kind: "edit"; entry: TimeEntry }
  | { kind: "delete"; entry: TimeEntry };

function EntryForm({ mode, onClose }: { mode: FormMode; onClose: () => void }) {
  const tasks = useStore((s) => s.tasks);
  const projectsById = useStore((s) => s.projectsById);
  const requestEntryChange = useStore((s) => s.requestEntryChange);

  const editing = mode.kind === "edit" ? mode.entry : undefined;
  const deleting = mode.kind === "delete" ? mode.entry : undefined;

  const [taskId, setTaskId] = useState<string>(
    editing?.taskId ?? tasks[0]?.id ?? ""
  );
  const [date, setDate] = useState<string>(editing?.date ?? realToday());
  const [start, setStart] = useState<string>(editing?.start_time ?? "09:00");
  const [end, setEnd] = useState<string>(editing?.end_time ?? "10:00");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const title =
    mode.kind === "add"
      ? "Request a new entry"
      : mode.kind === "edit"
        ? "Request an edit"
        : "Request deletion";

  const valid =
    mode.kind === "delete" ? true : !!taskId && !!date && start < end;

  const submit = async () => {
    if (!valid || saving) return;
    setSaving(true);
    const task = tasks.find((t) => t.id === taskId);
    const ok = await requestEntryChange(mode.kind, {
      timeLogId: editing?.id ?? deleting?.id,
      taskId,
      projectId: task?.project_id ?? null,
      date,
      start_time: start,
      end_time: end,
      note: editing?.title ?? "",
      reason,
    });
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <div className="form-overlay">
      <div className="form-head">
        <h1>{title}</h1>
        <button className="icon-btn" onClick={onClose} title="Close">
          <X className="icon" />
        </button>
      </div>
      <p className="muted small" style={{ marginBottom: 12 }}>
        Sent to your team lead for approval. Approved changes are marked edited.
      </p>

      {deleting ? (
        <div className="card-lite">
          <div className="task-title">{deleting.title}</div>
          <div className="faint small">
            {fmtDate(deleting.date)} · {deleting.start_time}–{deleting.end_time} ·{" "}
            {fmtDuration(deleting.minutes)}
          </div>
        </div>
      ) : (
        <div className="fields">
          <label className="field">
            <span>Task</span>
            <select
              className="input"
              value={taskId}
              onChange={(e) => setTaskId(e.target.value)}
            >
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {projectsById[t.project_id]?.name
                    ? `${projectsById[t.project_id]?.name}: ${t.title}`
                    : t.title}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Date</span>
            <input
              type="date"
              className="input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <div className="row">
            <label className="field" style={{ flex: 1 }}>
              <span>Start</span>
              <input
                type="time"
                className="input"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>
            <label className="field" style={{ flex: 1 }}>
              <span>End</span>
              <input
                type="time"
                className="input"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </label>
          </div>
          {!valid && start >= end && (
            <p className="small" style={{ color: "var(--danger)" }}>
              End must be after start.
            </p>
          )}
        </div>
      )}

      <label className="field" style={{ marginTop: 10 }}>
        <span>Reason (optional)</span>
        <input
          className="input"
          placeholder="Why this change?"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>

      <div className="row" style={{ marginTop: 14 }}>
        <button className="btn btn-ghost" onClick={onClose}>
          Cancel
        </button>
        <button
          className={`btn ${deleting ? "btn-danger-solid" : "btn-primary"}`}
          onClick={submit}
          disabled={!valid || saving}
        >
          {saving
            ? "Sending…"
            : deleting
              ? "Request deletion"
              : "Send request"}
        </button>
      </div>
    </div>
  );
}

export function EntriesView({ onBack }: { onBack: () => void }) {
  const entries = useStore((s) => s.entries);
  const loading = useStore((s) => s.entriesLoading);
  const loadEntries = useStore((s) => s.loadEntries);
  const [form, setForm] = useState<FormMode | null>(null);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const groups = useMemo(() => {
    const byDate = new Map<string, TimeEntry[]>();
    for (const e of entries) {
      const list = byDate.get(e.date) ?? [];
      list.push(e);
      byDate.set(e.date, list);
    }
    return Array.from(byDate.entries()).map(([date, list]) => {
      const workMin = list
        .filter((e) => e.kind === "work")
        .reduce((s, e) => s + e.minutes, 0);
      const breakMin = list
        .filter((e) => e.kind === "break")
        .reduce((s, e) => s + e.minutes, 0);
      return { date, list, workMin, breakMin };
    });
  }, [entries]);

  if (form) return <EntryForm mode={form} onClose={() => setForm(null)} />;

  return (
    <div className="screen">
      <div className="picker-head">
        <button className="icon-btn" onClick={onBack} title="Back">
          <ArrowLeft className="icon" />
        </button>
        <div style={{ flex: 1 }}>
          <h1>My time entries</h1>
          <p className="muted small">Edits need your lead’s approval.</p>
        </div>
        <button
          className="icon-btn"
          onClick={() => void loadEntries()}
          title="Refresh"
        >
          <RefreshCw className={`icon ${loading ? "spin" : ""}`} />
        </button>
      </div>

      <button
        className="btn btn-block"
        style={{ marginTop: 8 }}
        onClick={() => setForm({ kind: "add" })}
      >
        <Plus className="icon" /> Add a missing entry
      </button>

      <div className="grow task-list" style={{ marginTop: 8 }}>
        {!loading && entries.length === 0 && (
          <p
            className="faint small"
            style={{ textAlign: "center", padding: "28px 0" }}
          >
            No time entries yet. Start a timer to log your first one.
          </p>
        )}

        {groups.map((g) => (
          <section key={g.date} style={{ marginBottom: 6 }}>
            <div className="entry-day">
              <span className="section-label" style={{ margin: 0 }}>
                {fmtDate(g.date)}
              </span>
              <span className="faint small">
                {fmtDuration(g.workMin)} worked
                {g.breakMin > 0 && ` · ${fmtDuration(g.breakMin)} break`}
              </span>
            </div>
            {g.list.map((e) => (
              <div
                key={e.id}
                className={`entry ${e.kind === "break" ? "is-break" : ""}`}
              >
                {e.kind === "break" && (
                  <Coffee
                    className="icon"
                    style={{ color: "var(--amber)", width: 14, height: 14 }}
                  />
                )}
                <span className="entry-title">
                  {e.title}
                  {e.modified && <span className="tag tag-edited">edited</span>}
                  {e.pending && <span className="tag tag-pending">pending</span>}
                </span>
                <span className="entry-time faint">
                  {e.start_time}–{e.end_time}
                </span>
                <span className="entry-dur">{fmtDuration(e.minutes)}</span>
                {e.kind === "work" && !e.pending && (
                  <span className="entry-actions">
                    <button
                      className="icon-btn sm"
                      title="Request edit"
                      onClick={() => setForm({ kind: "edit", entry: e })}
                    >
                      <Pencil style={{ width: 13, height: 13 }} />
                    </button>
                    <button
                      className="icon-btn sm"
                      title="Request deletion"
                      onClick={() => setForm({ kind: "delete", entry: e })}
                    >
                      <Trash2 style={{ width: 13, height: 13 }} />
                    </button>
                  </span>
                )}
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
