// A trimmed copy of the web app's types — just what the timer needs. Kept local
// so the desktop app builds standalone (no cross-package imports).

export type Status =
  | "backlog"
  | "todo"
  | "in_progress"
  | "blocked"
  | "in_review"
  | "done";

export const STATUS_ORDER: Status[] = [
  "todo",
  "in_progress",
  "in_review",
  "blocked",
  "done",
];

export const STATUS_LABEL: Record<Status, string> = {
  backlog: "Backlog",
  todo: "To do",
  in_progress: "In progress",
  blocked: "Blocked",
  in_review: "In review",
  done: "Done",
};

export const STATUS_DOT: Record<Status, string> = {
  backlog: "#9ca3af",
  todo: "#94a3b8",
  in_progress: "#f59e0b",
  blocked: "#f43f5e",
  in_review: "#8b5cf6",
  done: "#10b981",
};

export type Urgency = "low" | "medium" | "high" | "urgent";

export type Role = "admin" | "team_lead" | "member";

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  role: Role;
  timezone: string;
}

export interface Project {
  id: string;
  name: string;
  color: string;
  status: "active" | "paused" | "done";
}

export interface Task {
  id: string;
  project_id: string;
  title: string;
  assignee_id: string | null;
  due_date: string | null;
  story_points: number | null;
  status: Status;
  urgency: Urgency;
}

export type BreakType = "short" | "lunch" | "other";

/** A row in the "my time entries" list — work (time_logs) or a break. */
export interface TimeEntry {
  id: string;
  kind: "work" | "break";
  date: string; // ISO date
  start_time: string; // "HH:MM"
  end_time: string; // "HH:MM"
  minutes: number;
  title: string; // task title, or break label
  taskId?: string | null; // work entries only
  projectId?: string | null; // work entries only
  modified?: boolean; // an approved edit was applied
  pending?: boolean; // has an open change request awaiting review
}

export const URGENCY_RANK: Record<Urgency, number> = {
  low: 0,
  medium: 1,
  high: 2,
  urgent: 3,
};

export const BREAK_LABEL: Record<BreakType, string> = {
  short: "Short break",
  lunch: "Lunch",
  other: "Away",
};

/** Picker order: My-Day-planned first, then by urgency, then soonest due. */
export function orderPickerTasks(tasks: Task[], planTaskIds: string[]): Task[] {
  const plan = new Set(planTaskIds);
  const dueVal = (t: Task) =>
    t.due_date ? Date.parse(t.due_date) : Number.MAX_SAFE_INTEGER;
  const cmp = (a: Task, b: Task) =>
    URGENCY_RANK[b.urgency] - URGENCY_RANK[a.urgency] ||
    dueVal(a) - dueVal(b) ||
    a.title.localeCompare(b.title);
  const planned = tasks.filter((t) => plan.has(t.id)).sort(cmp);
  const rest = tasks.filter((t) => !plan.has(t.id)).sort(cmp);
  return [...planned, ...rest];
}
