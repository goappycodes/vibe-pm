import { useMemo, useState } from "react";
import { Coffee, Play, Search } from "lucide-react";
import { useStore } from "../lib/store";
import { orderPickerTasks, type Task } from "../lib/types";

const PROJECT_DOT: Record<string, string> = {
  indigo: "#6366f1",
  emerald: "#10b981",
  amber: "#f59e0b",
  rose: "#f43f5e",
  sky: "#0ea5e9",
};

export function TaskPicker() {
  const tasks = useStore((s) => s.tasks);
  const planTaskIds = useStore((s) => s.planTaskIds);
  const projectsById = useStore((s) => s.projectsById);
  const startTimer = useStore((s) => s.startTimer);
  const startBreak = useStore((s) => s.startBreak);
  const [q, setQ] = useState("");

  const ordered = useMemo(
    () => orderPickerTasks(tasks, planTaskIds),
    [tasks, planTaskIds]
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
            {(t.urgency === "urgent" || t.urgency === "high") && (
              <span className={`badge ${t.urgency}`}>{t.urgency}</span>
            )}
          </div>
        </span>
        <Play className="icon play" fill="currentColor" />
      </button>
    );
  };

  return (
    <div className="screen">
      <h1>What are you working on?</h1>
      <p className="muted small">Pick a task — the timer starts right away.</p>

      <div style={{ position: "relative", marginTop: 12 }}>
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
            {planned.length ? "Assigned to me" : "Your tasks"}
          </div>
        )}
        {rest.map(item)}
        {filtered.length === 0 && (
          <p
            className="faint small"
            style={{ textAlign: "center", padding: "28px 0" }}
          >
            {tasks.length === 0
              ? "No open tasks assigned to you."
              : "No tasks match your search."}
          </p>
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
