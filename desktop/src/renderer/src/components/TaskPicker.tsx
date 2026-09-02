import { useMemo, useState } from "react";
import { Coffee, Play, Plus, Search, X } from "lucide-react";
import { useStore } from "../lib/store";
import { orderPickerTasks, type Project, type Task } from "../lib/types";

const PROJECT_DOT: Record<string, string> = {
  indigo: "#6366f1",
  emerald: "#10b981",
  amber: "#f59e0b",
  rose: "#f43f5e",
  sky: "#0ea5e9",
};

const SHOW_ALL_KEY = "vibe-timer.showAll";

export function TaskPicker() {
  const me = useStore((s) => s.me);
  const allTasks = useStore((s) => s.tasks);
  const planTaskIds = useStore((s) => s.planTaskIds);
  const projectsById = useStore((s) => s.projectsById);
  const startTimer = useStore((s) => s.startTimer);
  const startBreak = useStore((s) => s.startBreak);
  const [q, setQ] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showAll, setShowAll] = useState(() => {
    try {
      return localStorage.getItem(SHOW_ALL_KEY) === "1";
    } catch {
      return false;
    }
  });

  const toggleShowAll = () => {
    setShowAll((v) => {
      const next = !v;
      try {
        localStorage.setItem(SHOW_ALL_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const source = useMemo(
    () =>
      showAll ? allTasks : allTasks.filter((t) => t.assignee_id === me?.id),
    [showAll, allTasks, me]
  );
  const ordered = useMemo(
    () => orderPickerTasks(source, planTaskIds),
    [source, planTaskIds]
  );
  const plan = useMemo(() => new Set(planTaskIds), [planTaskIds]);
  const query = q.trim().toLowerCase();
  const filtered = query
    ? ordered.filter((t) => t.title.toLowerCase().includes(query))
    : ordered;
  const planned = filtered.filter((t) => plan.has(t.id));
  const rest = filtered.filter((t) => !plan.has(t.id));

  const item = (t: Task) => {
    const p = projectsById[t.project_id];
    const mine = t.assignee_id === me?.id;
    return (
      <button key={t.id} className="task-item" onClick={() => startTimer(t.id)}>
        <span
          className="pdot"
          style={{ background: PROJECT_DOT[p?.color ?? ""] ?? "#6b7280" }}
        />
        <span className="task-main">
          <div className="task-title">{t.title}</div>
          <div className="task-meta">
            <span>{p?.name ?? "No project"}</span>
            {showAll && !mine && <span className="badge">not mine</span>}
            {(t.urgency === "urgent" || t.urgency === "high") && (
              <span className={`badge ${t.urgency}`}>{t.urgency}</span>
            )}
          </div>
        </span>
        <Play className="icon play" fill="currentColor" />
      </button>
    );
  };

  if (showNew)
    return <NewTaskForm defaultTitle={q} onClose={() => setShowNew(false)} />;

  return (
    <div className="screen">
      <div className="picker-head">
        <div style={{ flex: 1 }}>
          <h1>What are you working on?</h1>
          <p className="muted small">Pick a task — the timer starts right away.</p>
        </div>
        <button
          className="icon-btn"
          title="New task"
          onClick={() => setShowNew(true)}
        >
          <Plus className="icon" />
        </button>
      </div>

      <label className="switch-row" title="Include tasks not assigned to you">
        <span className="small muted">
          {showAll ? "Showing all tasks" : "Only my tasks"}
        </span>
        <button
          role="switch"
          aria-checked={showAll}
          className={`switch ${showAll ? "on" : ""}`}
          onClick={toggleShowAll}
        >
          <span className="knob" />
        </button>
      </label>

      <div style={{ position: "relative", marginTop: 8 }}>
        <Search
          className="icon"
          style={{ position: "absolute", left: 10, top: 10, color: "var(--faint)" }}
        />
        <input
          className="input"
          style={{ paddingLeft: 32 }}
          placeholder="Search tasks…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
      </div>

      <div className="grow task-list" style={{ marginTop: 8 }}>
        {planned.length > 0 && <div className="section-label">Today’s plan</div>}
        {planned.map(item)}
        {rest.length > 0 && (
          <div className="section-label">
            {planned.length
              ? showAll
                ? "All tasks"
                : "Assigned to me"
              : showAll
                ? "All open tasks"
                : "Your tasks"}
          </div>
        )}
        {rest.map(item)}
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "28px 0" }}>
            <p className="faint small">
              {source.length === 0
                ? showAll
                  ? "No open tasks found."
                  : "No open tasks assigned to you — try “all tasks”."
                : "No tasks match your search."}
            </p>
            <button
              className="btn btn-ghost"
              style={{ marginTop: 10 }}
              onClick={() => setShowNew(true)}
            >
              <Plus className="icon" />
              {query ? `Create “${q.trim()}”` : "New task"}
            </button>
          </div>
        )}
      </div>

      <div
        style={{
          borderTop: "1px solid var(--border)",
          paddingTop: 10,
          marginTop: 6,
        }}
      >
        <button
          className="btn btn-ghost btn-block"
          onClick={() => startBreak("short")}
        >
          <Coffee className="icon" /> Take a break instead
        </button>
      </div>
    </div>
  );
}

function NewTaskForm({
  defaultTitle,
  onClose,
}: {
  defaultTitle: string;
  onClose: () => void;
}) {
  const projectsById = useStore((s) => s.projectsById);
  const addTask = useStore((s) => s.addTask);
  const startTimer = useStore((s) => s.startTimer);
  const projects = useMemo(
    () =>
      (Object.values(projectsById) as Project[]).sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
    [projectsById]
  );
  const [title, setTitle] = useState(defaultTitle);
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = title.trim().length > 0 && !!projectId;

  const create = async (start: boolean) => {
    if (!valid || saving) return;
    setSaving(true);
    setError(null);
    const id = await addTask({ title, projectId });
    setSaving(false);
    if (!id) {
      setError("Couldn't create the task. Please try again.");
      return;
    }
    if (start) startTimer(id);
    onClose();
  };

  return (
    <div className="form-overlay">
      <div className="form-head">
        <h1>New task</h1>
        <button className="icon-btn" onClick={onClose} title="Close">
          <X className="icon" />
        </button>
      </div>
      <p className="muted small" style={{ marginBottom: 12 }}>
        Adds a task assigned to you — start timing it now or just add it to your
        list.
      </p>

      {projects.length === 0 ? (
        <p className="faint small">
          No projects yet. Create a project in the web app first.
        </p>
      ) : (
        <div className="fields">
          <label className="field">
            <span>Title</span>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs doing?"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") void create(true);
              }}
            />
          </label>
          <label className="field">
            <span>Project</span>
            <select
              className="input"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          {error && (
            <p className="small" style={{ color: "var(--danger)" }}>
              {error}
            </p>
          )}
        </div>
      )}

      <div className="row" style={{ marginTop: 14 }}>
        <button
          className="btn"
          onClick={() => void create(false)}
          disabled={!valid || saving}
        >
          Add to list
        </button>
        <button
          className="btn btn-primary"
          onClick={() => void create(true)}
          disabled={!valid || saving}
        >
          {saving ? "Creating…" : "Create & start"}
        </button>
      </div>
    </div>
  );
}
