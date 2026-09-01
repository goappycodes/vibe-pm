// A trimmed copy of the web app's types — just what the timer needs. Kept local
// so the desktop app builds standalone (no cross-package imports).

export type Status =
  | "backlog"
  | "todo"
  | "in_progress"
  | "blocked"
  | "in_review"
  | "done";

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
