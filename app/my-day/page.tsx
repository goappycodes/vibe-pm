"use client";

import { TaskRow } from "@/components/TaskRow";
import { useStore } from "@/lib/store";
import type { Task } from "@/lib/types";
import { URGENCY_META } from "@/lib/types";
import { cn, daysFromToday, TODAY } from "@/lib/utils";
import { format } from "date-fns";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Sun,
} from "lucide-react";
import { useMemo, useState } from "react";

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
