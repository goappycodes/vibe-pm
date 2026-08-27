export type Status =
  | "backlog"
  | "todo"
  | "in_progress"
  | "blocked"
  | "in_review"
  | "done";

export type Urgency = "low" | "medium" | "high" | "urgent";

export type Role = "admin" | "team_lead" | "member";

export type UpdateSource = "slack" | "claude" | "ui";

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  role: Role;
  lead_id: string | null; // the team_lead this member reports to
  slack_user_id: string;
  timezone: string;
}

export interface Client {
  id: string;
  name: string;
  contact_name: string;
  contact_email: string;
  status: "active" | "archived";
  color: string; // token key
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  owner_id: string;
  client_id: string | null;
  status: "active" | "paused" | "done";
  color: string; // token key, e.g. "indigo"
  slack_channel_id: string | null; // channel name (from the connected workspace)
  target_date: string | null;
}

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string;
  assignee_id: string | null;
  due_date: string | null; // ISO date
  story_points: number | null; // agile estimate (Fibonacci)
  status: Status;
  urgency: Urgency;
  order: number;
  created_by: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export const STORY_POINTS = [1, 2, 3, 5, 8, 13] as const;

export interface SlackChannel {
  id: string;
  name: string;
}

export interface AppSettings {
  slack: {
    connected: boolean;
    workspace: string; // e.g. appycodes.slack.com
    team_name: string;
    channels: SlackChannel[];
  };
  general: {
    org_name: string;
    default_view: string; // route, e.g. /my-day
    week_start: "sunday" | "monday";
    timezone: string;
  };
}

export interface TaskDependency {
  task_id: string; // the dependent task
  depends_on_task_id: string; // must finish first
  type: "finish_start" | "blocks";
}

export interface Update {
  id: string;
  author_id: string;
  source: UpdateSource;
  raw_text: string;
  parsed: string;
  task_id: string | null;
  created_at: string;
}

export interface Comment {
  id: string;
  task_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
}

export interface Attachment {
  id: string;
  task_id: string;
  author_id: string | null;
  file_name: string;
  file_path: string;
  file_url: string;
  size: number;
  created_at: string;
}

export interface ActivityEntry {
  id: string;
  task_id: string;
  actor_id: string;
  field: string;
  from: string | null;
  to: string | null;
  source: UpdateSource;
  at: string;
}

export const ROLES: Role[] = ["admin", "team_lead", "member"];

export const ROLE_META: Record<
  Role,
  { label: string; className: string }
> = {
  admin: {
    label: "Admin",
    className:
      "border-transparent bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  },
  team_lead: {
    label: "Team lead",
    className:
      "border-transparent bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  },
  member: {
    label: "Member",
    className:
      "border-transparent bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300",
  },
};

export const STATUSES: Status[] = [
  "backlog",
  "todo",
  "in_progress",
  "blocked",
  "in_review",
  "done",
];

export const URGENCIES: Urgency[] = ["low", "medium", "high", "urgent"];

export const STATUS_META: Record<
  Status,
  { label: string; color: string; dot: string }
> = {
  backlog: { label: "Backlog", color: "text-faint", dot: "bg-gray-400" },
  todo: { label: "To do", color: "text-slate-500", dot: "bg-slate-400" },
  in_progress: {
    label: "In progress",
    color: "text-amber-600",
    dot: "bg-amber-500",
  },
  blocked: { label: "Blocked", color: "text-rose-600", dot: "bg-rose-500" },
  in_review: {
    label: "In review",
    color: "text-violet-600",
    dot: "bg-violet-500",
  },
  done: { label: "Done", color: "text-emerald-600", dot: "bg-emerald-500" },
};

export const URGENCY_META: Record<
  Urgency,
  { label: string; className: string; rank: number }
> = {
  low: {
    label: "Low",
    className:
      "border-transparent bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300",
    rank: 0,
  },
  medium: {
    label: "Medium",
    className:
      "border-transparent bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
    rank: 1,
  },
  high: {
    label: "High",
    className:
      "border-transparent bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    rank: 2,
  },
  urgent: {
    label: "Urgent",
    className:
      "border-transparent bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
    rank: 3,
  },
};

export const PROJECT_COLORS: Record<
  string,
  { dot: string; soft: string; text: string }
> = {
  indigo: {
    dot: "bg-indigo-500",
    soft: "bg-indigo-50 dark:bg-indigo-500/10",
    text: "text-indigo-600 dark:text-indigo-300",
  },
  emerald: {
    dot: "bg-emerald-500",
    soft: "bg-emerald-50 dark:bg-emerald-500/10",
    text: "text-emerald-600 dark:text-emerald-300",
  },
  amber: {
    dot: "bg-amber-500",
    soft: "bg-amber-50 dark:bg-amber-500/10",
    text: "text-amber-600 dark:text-amber-300",
  },
  rose: {
    dot: "bg-rose-500",
    soft: "bg-rose-50 dark:bg-rose-500/10",
    text: "text-rose-600 dark:text-rose-300",
  },
  sky: {
    dot: "bg-sky-500",
    soft: "bg-sky-50 dark:bg-sky-500/10",
    text: "text-sky-600 dark:text-sky-300",
  },
};
