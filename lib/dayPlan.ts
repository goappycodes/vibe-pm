"use client";

import { format, parseISO } from "date-fns";
import { useMemo } from "react";
import { useStore } from "./store";
import type { Task } from "./types";
import { formatDuration, today as todayDate, toISODate } from "./utils";

const DEFAULT_MIN_DAILY_POINTS = 3;

/**
 * The current user's plan for today: which tasks they picked to work on (My
 * Day), how much of it is done, and whether they've picked "enough" (in
 * story points) to unlock posting a daily standup update.
 */
export function useTodayPlan(userId?: string) {
  const tasks = useStore((s) => s.tasks);
  const currentUserId = useStore((s) => s.currentUserId);
  const daySelections = useStore((s) => s.daySelections);
  const minPoints =
    useStore((s) => s.settings.general.min_daily_points) ??
    DEFAULT_MIN_DAILY_POINTS;

  const uid = userId ?? currentUserId;
  const today = toISODate(todayDate());

  const planTasks = useMemo(() => {
    const ids = new Set(
      daySelections
        .filter((d) => d.user_id === uid && d.date === today)
        .map((d) => d.task_id)
    );
    return tasks.filter((t) => ids.has(t.id));
  }, [tasks, daySelections, uid, today]);

  const doneTasks = planTasks.filter((t) => t.status === "done");
  const blockedTasks = planTasks.filter((t) => t.status === "blocked");
  const pendingTasks = planTasks.filter((t) => t.status !== "done");
  const totalPoints = planTasks.reduce(
    (sum, t) => sum + (t.story_points ?? 0),
    0
  );
  const pct = planTasks.length
    ? Math.round((doneTasks.length / planTasks.length) * 100)
    : 0;

  return {
    today,
    planTasks,
    doneTasks,
    blockedTasks,
    pendingTasks,
    totalPoints,
    minPoints,
    enough: totalPoints >= minPoints,
    pct,
  };
}

/**
 * Render a day plan as a Slack-friendly standup message: who, the date, and the
 * picked tasks grouped by completed / in-progress / blocked, with a point tally.
 */
export function composeStandup(opts: {
  memberName: string | undefined;
  today: string;
  planTasks: Task[];
  doneTasks: Task[];
  blockedTasks: Task[];
  totalPoints: number;
  minutesLogged?: number;
  /** Resolves a task's project name — it prefixes each line in Slack. */
  projectName?: (projectId: string) => string | undefined;
}): string {
  const {
    memberName,
    today,
    planTasks,
    doneTasks,
    blockedTasks,
    totalPoints,
    minutesLogged = 0,
    projectName,
  } = opts;
  const inProgress = planTasks.filter(
    (t) => t.status !== "done" && t.status !== "blocked"
  );
  // Standups land in one shared channel, so each line says which project it
  // belongs to — a bare task title out of context means little to readers.
  const list = (items: Task[]) =>
    items
      .map((t) => {
        const project = projectName?.(t.project_id);
        return project ? `• *${project}* — ${t.title}` : `• ${t.title}`;
      })
      .join("\n");

  let dateLabel = today;
  try {
    dateLabel = format(parseISO(today), "EEE, MMM d");
  } catch {
    /* keep ISO fallback */
  }

  const parts: string[] = [
    `*${memberName ?? "Someone"}* — daily plan · ${dateLabel}`,
  ];
  if (doneTasks.length) parts.push(`✅ Completed\n${list(doneTasks)}`);
  if (inProgress.length)
    parts.push(`🔨 Planned / in progress\n${list(inProgress)}`);
  if (blockedTasks.length) parts.push(`🚧 Blockers\n${list(blockedTasks)}`);
  parts.push(
    `📌 ${planTasks.length} task${planTasks.length === 1 ? "" : "s"} · ${totalPoints} pt${totalPoints === 1 ? "" : "s"}${minutesLogged > 0 ? ` · 🕒 ${formatDuration(minutesLogged)} logged` : ""}`
  );
  return parts.join("\n\n");
}

/** The three buckets a standup splits into, as tasks rather than text. */
export interface StandupGroups {
  doneTasks: Task[];
  inProgress: Task[];
  blockedTasks: Task[];
}

export interface ProjectStandup {
  projectId: string;
  projectName: string;
  channel: string;
  taskCount: number;
  text: string;
}

/**
 * The same update, split per project, for posting into each project's own
 * channel. The team channel gets the whole picture; a project channel only
 * wants its own lines — but always with the person's name on top, since it
 * lands among everyone else's chatter.
 *
 * Projects without a Slack channel are skipped: there is nowhere to post.
 */
export function composeProjectStandups(opts: {
  memberName: string | undefined;
  today: string;
  groups: StandupGroups;
  projectOf: (
    projectId: string
  ) => { name: string; channel: string | null } | undefined;
}): ProjectStandup[] {
  const { memberName, today, groups, projectOf } = opts;

  let dateLabel = today;
  try {
    dateLabel = format(parseISO(today), "EEE, MMM d");
  } catch {
    /* keep ISO fallback */
  }

  const byProject = new Map<string, StandupGroups>();
  const bucket = (id: string) => {
    let g = byProject.get(id);
    if (!g) {
      g = { doneTasks: [], inProgress: [], blockedTasks: [] };
      byProject.set(id, g);
    }
    return g;
  };
  groups.doneTasks.forEach((t) => bucket(t.project_id).doneTasks.push(t));
  groups.inProgress.forEach((t) => bucket(t.project_id).inProgress.push(t));
  groups.blockedTasks.forEach((t) =>
    bucket(t.project_id).blockedTasks.push(t)
  );

  const out: ProjectStandup[] = [];
  for (const [projectId, g] of byProject) {
    const project = projectOf(projectId);
    if (!project?.channel) continue;
    const count =
      g.doneTasks.length + g.inProgress.length + g.blockedTasks.length;
    if (!count) continue;

    const list = (items: Task[]) =>
      items.map((t) => `• ${t.title}`).join("\n");
    const parts: string[] = [
      `*${memberName ?? "Someone"}* — daily update · ${dateLabel} · *${project.name}*`,
    ];
    if (g.doneTasks.length) parts.push(`✅ Completed\n${list(g.doneTasks)}`);
    if (g.inProgress.length)
      parts.push(`🔨 Planned / in progress\n${list(g.inProgress)}`);
    if (g.blockedTasks.length)
      parts.push(`🚧 Blockers\n${list(g.blockedTasks)}`);

    out.push({
      projectId,
      projectName: project.name,
      channel: project.channel,
      taskCount: count,
      text: parts.join("\n\n"),
    });
  }
  return out.sort((a, b) => a.projectName.localeCompare(b.projectName));
}

export type StandupPostResult = {
  ok: boolean;
  dryRun?: boolean;
  error?: string;
  channel?: string;
  duplicate?: boolean;
};

/** Post standup text to the team's Slack standup channel via the server route. */
export async function postStandupToSlack(
  text: string,
  channel?: string
): Promise<StandupPostResult> {
  const [only] = await postStandupMessages([{ text, channel }]);
  return only ?? { ok: false, error: "network" };
}

/**
 * Post several standup messages in one request — the team channel plus one
 * per project. The route dedupes each (channel, text) pair, so a double
 * submit can't double-post any of them.
 */
export async function postStandupMessages(
  messages: { text: string; channel?: string }[]
): Promise<StandupPostResult[]> {
  if (!messages.length) return [];
  try {
    const res = await fetch("/api/slack/standup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });
    const body = (await res.json()) as
      | { results?: StandupPostResult[] }
      | StandupPostResult;
    if ("results" in body && Array.isArray(body.results)) return body.results;
    return [body as StandupPostResult];
  } catch {
    return messages.map(() => ({ ok: false, error: "network" }));
  }
}
