"use client";

import { Avatar } from "@/components/Avatar";
import { PointsBadge, ProjectBadge } from "@/components/Badges";
import { DayPlanPicker } from "@/components/DayPlanPicker";
import { ProjectPicker, StatusPicker } from "@/components/Pickers";
import { TaskRow } from "@/components/TaskRow";
import { useTodayPlan } from "@/lib/dayPlan";
import { useStore } from "@/lib/store";
import {
  ROLE_META,
  STATUSES,
  STATUS_META,
  URGENCY_META,
  type Task,
  type TeamMember,
} from "@/lib/types";
import {
  addDays,
  cn,
  daysFromToday,
  formatDuration,
  TODAY,
  toISODate,
} from "@/lib/utils";
import {
  ArrowLeft,
  Ban,
  Clock,
  ListChecks,
  ListPlus,
  Plus,
  ShieldCheck,
  Sun,
  Target,
  TriangleAlert,
  X,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useRef, useState } from "react";

type BucketKey = "overdue" | "today" | "week" | "later" | "none";
const BUCKETS: { key: BucketKey; label: string }[] = [
  { key: "overdue", label: "Overdue" },
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "later", label: "Later" },
  { key: "none", label: "No due date" },
];
function bucketOf(t: Task): BucketKey {
  const d = daysFromToday(t.due_date);
  if (d === null) return "none";
  if (d < 0) return "overdue";
  if (d === 0) return "today";
  if (d <= 6) return "week";
  return "later";
}

export default function MemberPage() {
  const params = useParams();
  const id = String(params.id);
  const member = useStore((s) => s.members.find((m) => m.id === id));
  const lead = useStore((s) =>
    s.members.find((m) => m.id === member?.lead_id)
  );
  const reports = useStore((s) =>
    s.members.filter((m) => m.lead_id === id)
  );
  const tasks = useStore((s) => s.tasks);
  const projects = useStore((s) => s.projects);
  const defaultProjectId = useStore((s) => s.defaultProjectId);
  const timeLogs = useStore((s) => s.timeLogs);
  const isAdmin = useStore(
    (s) => s.members.find((m) => m.id === s.currentUserId)?.role === "admin"
  );

  const mine = useMemo(
    () => tasks.filter((t) => t.assignee_id === id),
    [tasks, id]
  );
  const open = mine.filter((t) => t.status !== "done");
  const done = mine.filter((t) => t.status === "done");

  const openPoints = open.reduce((a, t) => a + (t.story_points ?? 0), 0);
  const overdue = open.filter((t) => {
    const d = daysFromToday(t.due_date);
    return d !== null && d < 0;
  }).length;
  const blocked = open.filter((t) => t.status === "blocked").length;

  // Time logged by this member in the last 7 days — recent effort for leads.
  const logged7d = useMemo(() => {
    const since = toISODate(addDays(TODAY, -6));
    return timeLogs
      .filter((l) => l.user_id === id && l.date >= since)
      .reduce((sum, l) => sum + l.minutes, 0);
  }, [timeLogs, id]);

  // workload by status (open only)
  const byStatus = STATUSES.filter((s) => s !== "done").map((s) => {
    const list = open.filter((t) => t.status === s);
    return {
      status: s,
      count: list.length,
      points: list.reduce((a, t) => a + (t.story_points ?? 0), 0),
    };
  });
  const totalStatusPts = byStatus.reduce((a, s) => a + s.points, 0) || 1;

  // by project
  const byProject = projects
    .map((p) => ({
      project: p,
      count: open.filter((t) => t.project_id === p.id).length,
    }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count);

  const grouped = useMemo(() => {
    const map: Record<BucketKey, Task[]> = {
      overdue: [],
      today: [],
      week: [],
      later: [],
      none: [],
    };
    for (const t of open) map[bucketOf(t)].push(t);
    for (const k of Object.keys(map) as BucketKey[]) {
      map[k].sort((a, b) => {
        const u =
          URGENCY_META[b.urgency].rank - URGENCY_META[a.urgency].rank;
        if (u !== 0) return u;
        const da = daysFromToday(a.due_date);
        const db = daysFromToday(b.due_date);
        if (da === null) return 1;
        if (db === null) return -1;
        return da - db;
      });
    }
    return map;
  }, [open]);

  if (!member) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-faint">
        Member not found.
        <Link href="/team" className="btn-outline">
          Back to Team
        </Link>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-6">
        <Link
          href="/team"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg"
        >
          <ArrowLeft className="h-4 w-4" />
          Team
        </Link>

        {/* header */}
        <div className="flex items-start gap-4">
          <Avatar member={member} size="lg" />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold text-fg">{member.name}</h2>
              <span className={cn("chip", ROLE_META[member.role].className)}>
                {ROLE_META[member.role].label}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
              <span>{member.email || "—"}</span>
              {lead && (
                <span className="flex items-center gap-1.5">
                  Reports to
                  <Link
                    href={`/member/${lead.id}`}
                    className="flex items-center gap-1 text-fg hover:text-accent"
                  >
                    <Avatar member={lead} size="xs" />
                    {lead.name}
                  </Link>
                </span>
              )}
              {reports.length > 0 && (
                <span>
                  Leads {reports.length}{" "}
                  {reports.length === 1 ? "person" : "people"}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* stats */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat icon={<ListChecks className="h-4 w-4" />} label="Open tasks" value={open.length} />
          <Stat icon={<Target className="h-4 w-4" />} label="Story points" value={openPoints} />
          <Stat
            icon={<Ban className="h-4 w-4" />}
            label="Blocked"
            value={blocked}
            tone={blocked > 0 ? "amber" : undefined}
          />
          <Stat
            icon={<TriangleAlert className="h-4 w-4" />}
            label="Overdue"
            value={overdue}
            tone={overdue > 0 ? "rose" : undefined}
          />
          <Stat icon={<ListChecks className="h-4 w-4" />} label="Completed" value={done.length} />
          <Stat
            icon={<Clock className="h-4 w-4" />}
            label="Logged 7d"
            value={logged7d > 0 ? formatDuration(logged7d) : "0m"}
          />
        </div>

        {/* admin controls: add tasks + plan the day for this member */}
        {isAdmin && <AdminMemberActions member={member} />}

        {/* workload */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="card p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-faint">
              Workload by status
            </h3>
            <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-2">
              {byStatus.map((s) =>
                s.points > 0 ? (
                  <div
                    key={s.status}
                    className={cn("h-full", STATUS_META[s.status].dot)}
                    style={{ width: `${(s.points / totalStatusPts) * 100}%` }}
                    title={`${STATUS_META[s.status].label}: ${s.points} pts`}
                  />
                ) : null
              )}
            </div>
            <div className="mt-3 space-y-1.5">
              {byStatus
                .filter((s) => s.count > 0)
                .map((s) => (
                  <div
                    key={s.status}
                    className="flex items-center gap-2 text-sm"
                  >
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full",
                        STATUS_META[s.status].dot
                      )}
                    />
                    <span className="flex-1 text-muted">
                      {STATUS_META[s.status].label}
                    </span>
                    <span className="text-fg">
                      {s.count}{" "}
                      <span className="text-faint">· {s.points} pts</span>
                    </span>
                  </div>
                ))}
              {open.length === 0 && (
                <div className="text-sm text-faint">No open tasks.</div>
              )}
            </div>
          </div>

          <div className="card p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-faint">
              Projects
            </h3>
            <div className="space-y-2">
              {byProject.map(({ project, count }) => (
                <div key={project.id} className="flex items-center gap-2">
                  <ProjectBadge project={project} />
                  <span className="ml-auto text-sm text-muted">
                    {count} open
                  </span>
                </div>
              ))}
              {byProject.length === 0 && (
                <div className="text-sm text-faint">No active projects.</div>
              )}
            </div>
          </div>
        </div>

        {/* tasks timeline */}
        <div className="mt-6">
          <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-faint">
            Tasks
          </h3>
          <div className="space-y-5">
            {BUCKETS.map((b) => {
              const list = grouped[b.key];
              if (list.length === 0) return null;
              return (
                <section key={b.key}>
                  <div className="mb-1 flex items-center gap-2 px-2.5">
                    <span
                      className={cn(
                        "text-[11px] font-semibold uppercase tracking-wide",
                        b.key === "overdue"
                          ? "text-rose-600"
                          : b.key === "today"
                            ? "text-amber-600"
                            : "text-faint"
                      )}
                    >
                      {b.label}
                    </span>
                    <span className="text-[11px] text-faint">{list.length}</span>
                  </div>
                  <div className="space-y-0.5">
                    {list.map((t) => (
                      <TaskRow key={t.id} task={t} />
                    ))}
                  </div>
                </section>
              );
            })}
            {open.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border py-12 text-center text-sm text-faint">
                Nothing open assigned to {member.name.split(" ")[0]}.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Admin-only panel on a member's page: add tasks to them and build their day. */
function AdminMemberActions({ member }: { member: TeamMember }) {
  const addTask = useStore((s) => s.addTask);
  const projects = useStore((s) => s.projects);
  const defaultProjectId = useStore((s) => s.defaultProjectId);
  const updateTask = useStore((s) => s.updateTask);
  const removeFromDayPlan = useStore((s) => s.removeFromDayPlan);
  const { planTasks, doneTasks, totalPoints } = useTodayPlan(member.id);
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const pid = projectId || defaultProjectId() || projects[0]?.id || "";
  const first = member.name.split(" ")[0];

  const submit = () => {
    const t = title.trim();
    if (!t || !pid) return;
    addTask({
      title: t,
      assignee_id: member.id,
      due_date: toISODate(TODAY),
      status: "todo",
      project_id: pid,
    });
    setTitle("");
    inputRef.current?.focus();
  };

  return (
    <div className="card mt-6 p-4">
      <div className="mb-3 flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-violet-500" />
        <h3 className="text-sm font-semibold text-fg">
          Admin · manage {first}
        </h3>
      </div>

      {/* quick add, assigned to this member */}
      <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 transition-colors focus-within:border-accent">
        <Plus className="h-4 w-4 shrink-0 text-faint" />
        <input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder={`Add a task for ${first}…`}
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

      {/* today's plan for this member */}
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-fg">
            <Sun className="h-4 w-4 shrink-0 text-amber-500" />
            <span className="truncate">{first}&apos;s plan today</span>
            {planTasks.length > 0 && (
              <span className="shrink-0 text-xs font-normal text-faint">
                {doneTasks.length}/{planTasks.length} done · {totalPoints} pt
                {totalPoints === 1 ? "" : "s"}
              </span>
            )}
          </div>
          <button
            onClick={() => setPickerOpen(true)}
            className="btn-outline shrink-0 gap-1.5 text-xs"
          >
            <ListPlus className="h-3.5 w-3.5" />
            {planTasks.length ? "Edit plan" : "Plan the day"}
          </button>
        </div>

        {planTasks.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border py-4 text-center text-xs text-faint">
            Nothing planned for today yet.
          </p>
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
                  onClick={() => removeFromDayPlan(t.id, member.id)}
                  className="shrink-0 text-faint opacity-0 transition-opacity hover:text-rose-600 group-hover:opacity-100"
                  title="Remove from plan"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {pickerOpen && (
        <DayPlanPicker userId={member.id} onClose={() => setPickerOpen(false)} />
      )}
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  tone?: "rose" | "amber";
}) {
  return (
    <div className="card flex items-center gap-3 p-3.5">
      <span
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-lg",
          tone === "rose"
            ? "bg-rose-50 text-rose-600 dark:bg-rose-500/10"
            : tone === "amber"
              ? "bg-amber-50 text-amber-600 dark:bg-amber-500/10"
              : "bg-surface-2 text-muted"
        )}
      >
        {icon}
      </span>
      <div>
        <div className="text-xl font-semibold leading-none tabular-nums text-fg">
          {value}
        </div>
        <div className="mt-1 text-xs text-faint">{label}</div>
      </div>
    </div>
  );
}
