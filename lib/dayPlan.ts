"use client";

import { format, parseISO } from "date-fns";
import { useMemo } from "react";
import { useStore } from "./store";
import type { Task } from "./types";
import { TODAY, toISODate } from "./utils";

const DEFAULT_MIN_DAILY_POINTS = 3;

/**
 * The current user's plan for today: which tasks they picked to work on (My
 * Day), how much of it is done, and whether they've picked "enough" (in
 * story points) to unlock posting a daily standup update.
 */
export function useTodayPlan() {
  const tasks = useStore((s) => s.tasks);
  const currentUserId = useStore((s) => s.currentUserId);
  const daySelections = useStore((s) => s.daySelections);
  const minPoints =
    useStore((s) => s.settings.general.min_daily_points) ??
    DEFAULT_MIN_DAILY_POINTS;

  const today = toISODate(TODAY);

  const planTasks = useMemo(() => {
    const ids = new Set(
      daySelections
        .filter((d) => d.user_id === currentUserId && d.date === today)
        .map((d) => d.task_id)
    );
    return tasks.filter((t) => ids.has(t.id));
  }, [tasks, daySelections, currentUserId, today]);

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
}): string {
  const { memberName, today, planTasks, doneTasks, blockedTasks, totalPoints } =
    opts;
  const inProgress = planTasks.filter(
    (t) => t.status !== "done" && t.status !== "blocked"
  );
  const list = (items: Task[]) =>
    items.map((t) => `• ${t.title}`).join("\n");

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
    `📌 ${planTasks.length} task${planTasks.length === 1 ? "" : "s"} · ${totalPoints} pt${totalPoints === 1 ? "" : "s"}`
  );
  return parts.join("\n\n");
}

export type StandupPostResult = {
  ok: boolean;
  dryRun?: boolean;
  error?: string;
  channel?: string;
};

/** Post standup text to the team's Slack standup channel via the server route. */
export async function postStandupToSlack(
  text: string,
  channel?: string
): Promise<StandupPostResult> {
  try {
    const res = await fetch("/api/slack/standup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, channel }),
    });
    return (await res.json()) as StandupPostResult;
  } catch {
    return { ok: false, error: "network" };
  }
}
