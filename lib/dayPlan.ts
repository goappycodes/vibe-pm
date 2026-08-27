"use client";

import { useMemo } from "react";
import { useStore } from "./store";
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
