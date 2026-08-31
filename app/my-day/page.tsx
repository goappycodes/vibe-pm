"use client";

import { DayPlanPicker } from "@/components/DayPlanPicker";
import { PointsBadge } from "@/components/Badges";
import { ProjectPicker, StatusPicker } from "@/components/Pickers";
import { TaskRow } from "@/components/TaskRow";
import { composeStandup, postStandupToSlack, useTodayPlan } from "@/lib/dayPlan";
import { useStore } from "@/lib/store";
import type { Task } from "@/lib/types";
import { URGENCY_META } from "@/lib/types";
import { cn, daysFromToday, TODAY, toISODate } from "@/lib/utils";
import { format } from "date-fns";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  ListPlus,
  Loader2,
  Plus,
  Send,
  Sun,
  X,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";

type BucketKey = "overdue" | "today" | "tomorrow" | "week" | "later" | "none";

const BUCKETS: { key: BucketKey; label: string }[] = [
  { key: "overdue", label: "Overdue" },
  { key: "today", label: "Today" },
  { key: "tomorrow", label: "Tomorrow" },
  { key: "week", label: "This week" },
  { key: "later", label: "Later" },
  { key: "none", label: "No due date" },
];

function bucketOf(task: Task): BucketKey {
  const d = daysFromToday(task.due_date);
  if (d === null) return "none";
  if (d < 0) return "overdue";
  if (d === 0) return "today";
  if (d === 1) return "tomorrow";
  if (d <= 6) return "week";
  return "later";
}

function sortTasks(a: Task, b: Task) {
  const u = URGENCY_META[b.urgency].rank - URGENCY_META[a.urgency].rank;
  if (u !== 0) return u;
  const da = daysFromToday(a.due_date);
  const db = daysFromToday(b.due_date);
  if (da === null) return 1;
  if (db === null) return -1;
  return da - db;
}

export default function MyDayPage() {
  const tasks = useStore((s) => s.tasks);
  const currentUserId = useStore((s) => s.currentUserId);
  const currentUser = useStore((s) =>
    s.members.find((m) => m.id === s.currentUserId)
  );
  const [showDone, setShowDone] = useState(false);

  const mine = useMemo(
    () => tasks.filter((t) => t.assignee_id === currentUserId),
    [tasks, currentUserId]
  );
  const active = mine.filter((t) => t.status !== "done");
  const done = mine.filter((t) => t.status === "done");

  const grouped = useMemo(() => {
    const map: Record<BucketKey, Task[]> = {
      overdue: [],
      today: [],
      tomorrow: [],
      week: [],
      later: [],
      none: [],
    };
    for (const t of active) map[bucketOf(t)].push(t);
    for (const k of Object.keys(map) as BucketKey[]) map[k].sort(sortTasks);
    return map;
  }, [active]);

  const overdueCount = grouped.overdue.length;
  const todayCount = grouped.today.length;
  const inProgress = active.filter((t) => t.status === "in_progress").length;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-6">
        {/* greeting + stats */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-muted">
            <Sun className="h-4 w-4 text-amber-500" />
            {format(TODAY, "EEEE, MMMM d")}
          </div>
          <h2 className="mt-1 text-2xl font-semibold text-fg">
            Good morning, {currentUser?.name.split(" ")[0]}
          </h2>
          <p className="mt-1 text-sm text-muted">
            You have {active.length} open{" "}
            {active.length === 1 ? "task" : "tasks"}
            {overdueCount > 0 && (
              <>
                {" "}
                · <span className="text-rose-600">{overdueCount} overdue</span>
              </>
            )}
            .
          </p>
        </div>

        <div className="mb-6 grid grid-cols-3 gap-3">
          <StatTile
            icon={<AlertTriangle className="h-4 w-4" />}
            label="Overdue"
            value={overdueCount}
            tone="rose"
          />
          <StatTile
            icon={<CircleDot className="h-4 w-4" />}
            label="Due today"
            value={todayCount}
            tone="amber"
          />
          <StatTile
            icon={<CheckCircle2 className="h-4 w-4" />}
            label="In progress"
            value={inProgress}
            tone="indigo"
          />
        </div>

        <TodayPlan />

        <QuickAdd />

        {/* buckets */}
        <div className="space-y-6">
          {BUCKETS.map((bucket) => {
            const list = grouped[bucket.key];
            if (list.length === 0) return null;
            return (
              <section key={bucket.key}>
                <div className="mb-1.5 flex items-center gap-2 px-2.5">
                  <h3
                    className={cn(
                      "text-xs font-semibold uppercase tracking-wide",
                      bucket.key === "overdue"
                        ? "text-rose-600"
                        : bucket.key === "today"
                          ? "text-amber-600"
                          : "text-faint"
                    )}
                  >
                    {bucket.label}
                  </h3>
                  <span className="text-xs text-faint">{list.length}</span>
                </div>
                <div className="space-y-0.5">
                  {list.map((t) => (
                    <TaskRow key={t.id} task={t} />
                  ))}
                </div>
              </section>
            );
          })}

          {active.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border py-16 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
              <p className="mt-2 text-sm font-medium text-fg">All clear</p>
              <p className="text-xs text-faint">
                Nothing open assigned to you. Enjoy the calm.
              </p>
            </div>
          )}

          {/* completed */}
          {done.length > 0 && (
            <section>
              <button
                onClick={() => setShowDone((v) => !v)}
                className="mb-1.5 flex items-center gap-1.5 px-2.5 text-xs font-semibold uppercase tracking-wide text-faint hover:text-muted"
              >
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 transition-transform",
                    !showDone && "-rotate-90"
                  )}
                />
                Completed
                <span>{done.length}</span>
              </button>
              {showDone && (
                <div className="space-y-0.5 opacity-70">
                  {done.map((t) => (
                    <TaskRow key={t.id} task={t} />
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function TodayPlan() {
  const updateTask = useStore((s) => s.updateTask);
  const removeFromDayPlan = useStore((s) => s.removeFromDayPlan);
  const addUpdate = useStore((s) => s.addUpdate);
  const currentUser = useStore((s) =>
    s.members.find((m) => m.id === s.currentUserId)
  );
  const channels = useStore((s) => s.settings.slack.channels);
  const timeLogs = useStore((s) => s.timeLogs);
  const { today, planTasks, doneTasks, blockedTasks, totalPoints, minPoints, enough, pct } =
    useTodayPlan();
  const minutesLogged = timeLogs
    .filter((l) => l.user_id === currentUser?.id && l.date === today)
    .reduce((sum, l) => sum + l.minutes, 0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [posting, setPosting] = useState(false);
  const [postMsg, setPostMsg] = useState<string | null>(null);

  const submitStandup = async () => {
    if (!planTasks.length || posting) return;
    setPosting(true);
    setPostMsg(null);
    const text = composeStandup({
      memberName: currentUser?.name,
      today,
      planTasks,
      doneTasks,
      blockedTasks,
      totalPoints,
      minutesLogged,
    });
    const hint =
      channels.find((c) => /standup/i.test(c.name))?.name ?? "standups";
    const res = await postStandupToSlack(text, hint);
    // Record it in the updates feed either way; tag the source by what happened.
    addUpdate(text, res.ok ? "slack" : "ui");
    setPostMsg(
      res.ok
        ? `Posted to ${res.channel ?? "Slack"} ✓`
        : res.dryRun
          ? "Saved to updates — Slack not connected yet"
          : `Saved to updates — Slack error${res.error ? `: ${res.error}` : ""}`
    );
    setPosting(false);
  };

  return (
    <div className="card mb-6 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-fg">Today&apos;s plan</h3>
          {planTasks.length > 0 && (
            <p className="mt-0.5 text-xs text-faint">
              {doneTasks.length} of {planTasks.length} done · {totalPoints} pt
              {totalPoints === 1 ? "" : "s"}
              {!enough && (
                <span className="text-amber-600">
                  {" "}
                  · plan {minPoints - totalPoints} more to post a standup
                </span>
              )}
            </p>
          )}
        </div>
        <button
          onClick={() => setPickerOpen(true)}
          className="btn-outline shrink-0 gap-1.5 text-xs"
        >
          <ListPlus className="h-3.5 w-3.5" />
          {planTasks.length ? "Edit plan" : "Plan my day"}
        </button>
      </div>

      {planTasks.length > 0 && (
        <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {planTasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-8 text-center">
          <p className="text-sm text-muted">
            Pick what you&apos;re working on today.
          </p>
          <p className="mt-0.5 text-xs text-faint">
            Selecting tasks unlocks your daily standup post.
          </p>
        </div>
      ) : (
        <div className="space-y-0.5">
          {planTasks.map((t) => (
            <div
              key={t.id}
              className="group flex items-center gap-3 rounded-xl px-2.5 py-1.5 transition-colors hover:bg-surface-2"
            >
              <StatusPicker
                value={t.status}
                onChange={(s) => updateTask(t.id, { status: s })}
              />
              <span
                className={cn(
                  "min-w-0 flex-1 truncate text-sm text-fg",
                  t.status === "done" && "text-faint line-through"
                )}
              >
                {t.title}
              </span>
              {t.story_points != null && (
                <PointsBadge points={t.story_points} />
              )}
              <button
                onClick={() => removeFromDayPlan(t.id)}
                className="shrink-0 text-faint opacity-0 transition-opacity hover:text-rose-600 group-hover:opacity-100"
                title="Remove from today"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {planTasks.length > 0 && (
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
          <p
            className={cn(
              "min-w-0 truncate text-xs",
              postMsg?.startsWith("Posted")
                ? "text-emerald-600 dark:text-emerald-400"
                : postMsg
                  ? "text-amber-600"
                  : "text-faint"
            )}
          >
            {postMsg ?? "Share today's plan with the team on Slack."}
          </p>
          <button
            onClick={submitStandup}
            disabled={posting}
            className="btn-primary shrink-0 gap-1.5 text-xs disabled:opacity-40"
            title="Post this plan as your daily update to Slack"
          >
            {posting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Post to Slack
          </button>
        </div>
      )}

      {pickerOpen && <DayPlanPicker onClose={() => setPickerOpen(false)} />}
    </div>
  );
}

function QuickAdd() {
  const addTask = useStore((s) => s.addTask);
  const projects = useStore((s) => s.projects);
  const currentUserId = useStore((s) => s.currentUserId);
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const pid = projectId || projects[0]?.id || "";

  const submit = () => {
    const t = title.trim();
    if (!t || !pid) return;
    addTask({
      title: t,
      assignee_id: currentUserId,
      due_date: toISODate(TODAY),
      status: "todo",
      project_id: pid,
    });
    setTitle("");
    inputRef.current?.focus();
  };

  return (
    <div className="mb-6 flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 shadow-soft transition-colors focus-within:border-accent">
      <Plus className="h-4 w-4 shrink-0 text-faint" />
      <input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        placeholder="Add a task for today…"
        className="min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-faint"
      />
      <ProjectPicker value={pid} onChange={setProjectId} />
      <button
        onClick={submit}
        disabled={!title.trim()}
        className="btn-primary shrink-0 py-1 text-xs disabled:opacity-40"
      >
        Add
      </button>
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "rose" | "amber" | "indigo";
}) {
  const tones = {
    rose: "text-rose-600 bg-rose-50 dark:bg-rose-500/10",
    amber: "text-amber-600 bg-amber-50 dark:bg-amber-500/10",
    indigo: "text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10",
  }[tone];
  return (
    <div className="card flex items-center gap-3 p-3.5">
      <span
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-lg",
          tones
        )}
      >
        {icon}
      </span>
      <div>
        <div className="text-xl font-semibold leading-none text-fg tabular-nums">
          {value}
        </div>
        <div className="mt-1 text-xs text-faint">{label}</div>
      </div>
    </div>
  );
}
