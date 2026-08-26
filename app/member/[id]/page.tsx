"use client";

import { Avatar } from "@/components/Avatar";
import { ProjectBadge } from "@/components/Badges";
import { TaskRow } from "@/components/TaskRow";
import { useStore } from "@/lib/store";
import {
  ROLE_META,
  STATUSES,
  STATUS_META,
  URGENCY_META,
  type Task,
} from "@/lib/types";
import { cn, daysFromToday } from "@/lib/utils";
import { ArrowLeft, ListChecks, Target, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";

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
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat icon={<ListChecks className="h-4 w-4" />} label="Open tasks" value={open.length} />
          <Stat icon={<Target className="h-4 w-4" />} label="Story points" value={openPoints} />
          <Stat
            icon={<TriangleAlert className="h-4 w-4" />}
            label="Overdue"
            value={overdue}
            tone={overdue > 0 ? "rose" : undefined}
          />
          <Stat icon={<ListChecks className="h-4 w-4" />} label="Completed" value={done.length} />
        </div>

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

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone?: "rose";
}) {
  return (
    <div className="card flex items-center gap-3 p-3.5">
      <span
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-lg",
          tone === "rose"
            ? "bg-rose-50 text-rose-600 dark:bg-rose-500/10"
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
