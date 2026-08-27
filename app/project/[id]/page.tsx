"use client";

import { Avatar } from "@/components/Avatar";
import { TaskRow } from "@/components/TaskRow";
import { useStore } from "@/lib/store";
import {
  PROJECT_COLORS,
  STATUSES,
  STATUS_META,
  type Task,
} from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";
import {
  ArrowLeft,
  CheckCircle2,
  Hash,
  ListChecks,
  Target,
  Users2,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";

const sumPts = (list: Task[]) =>
  list.reduce((a, t) => a + (t.story_points ?? 0), 0);

const PROJECT_STATUS_LABEL: Record<string, string> = {
  active: "Active",
  paused: "Paused",
  done: "Done",
};

export default function ProjectPage() {
  const params = useParams();
  const id = String(params.id);
  const project = useStore((s) => s.projects.find((p) => p.id === id));
  const tasks = useStore((s) => s.tasks);
  const members = useStore((s) => s.members);
  const client = useStore((s) =>
    s.clients.find((c) => c.id === project?.client_id)
  );
  const owner = useStore((s) =>
    s.members.find((m) => m.id === project?.owner_id)
  );

  const projTasks = useMemo(
    () => tasks.filter((t) => t.project_id === id),
    [tasks, id]
  );

  const open = projTasks.filter((t) => t.status !== "done");
  const done = projTasks.filter((t) => t.status === "done");
  const totalPts = sumPts(projTasks);
  const donePts = sumPts(done);
  const progress =
    totalPts > 0
      ? Math.round((donePts / totalPts) * 100)
      : projTasks.length > 0
        ? Math.round((done.length / projTasks.length) * 100)
        : 0;

  const team = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of open) {
      if (t.assignee_id)
        counts.set(t.assignee_id, (counts.get(t.assignee_id) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([mid, n]) => ({ member: members.find((m) => m.id === mid), n }))
      .filter((x) => x.member)
      .sort((a, b) => b.n - a.n);
  }, [open, members]);

  const grouped = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const s of STATUSES) map[s] = [];
    for (const t of projTasks) map[t.status].push(t);
    return map;
  }, [projTasks]);

  if (!project) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-faint">
        Project not found.
        <Link href="/projects" className="btn-outline">
          Back to Projects
        </Link>
      </div>
    );
  }

  const c = PROJECT_COLORS[project.color] ?? PROJECT_COLORS.indigo;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-6">
        <Link
          href="/projects"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg"
        >
          <ArrowLeft className="h-4 w-4" />
          Projects
        </Link>

        {/* header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className={cn("h-4 w-4 rounded-full", c.dot)} />
            <h2 className="text-2xl font-semibold text-fg">{project.name}</h2>
          </div>
          <span
            className={cn(
              "chip",
              project.status === "active"
                ? "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                : "border-transparent bg-slate-100 text-slate-500 dark:bg-slate-500/15 dark:text-slate-400"
            )}
          >
            {PROJECT_STATUS_LABEL[project.status]}
          </span>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted">
          {client && <span>Client · {client.name}</span>}
          {owner && (
            <span className="flex items-center gap-1.5">
              Owner
              <Avatar member={owner} size="xs" />
              {owner.name.split(" ")[0]}
            </span>
          )}
          {project.slack_channel_id && (
            <span className="flex items-center gap-1 text-fg">
              <Hash className="h-3.5 w-3.5 text-faint" />
              {project.slack_channel_id}
            </span>
          )}
          {project.target_date && (
            <span>Target {formatDate(project.target_date)}</span>
          )}
        </div>

        {/* stats */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat icon={<ListChecks className="h-4 w-4" />} label="Open tasks" value={open.length} />
          <Stat icon={<Target className="h-4 w-4" />} label="Open points" value={sumPts(open)} />
          <Stat icon={<CheckCircle2 className="h-4 w-4" />} label="Done tasks" value={done.length} />
          <Stat icon={<Users2 className="h-4 w-4" />} label="Contributors" value={team.length} />
        </div>

        {/* progress */}
        <div className="mt-4 card p-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium text-fg">Progress</span>
            <span className="text-muted">
              {donePts}/{totalPts} pts · {progress}%
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className={cn("h-full rounded-full", c.dot)}
              style={{ width: `${progress}%` }}
            />
          </div>
          {team.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-3">
              {team.map(({ member, n }) => (
                <Link
                  key={member!.id}
                  href={`/member/${member!.id}`}
                  className="flex items-center gap-1.5 text-xs text-muted hover:text-fg"
                >
                  <Avatar member={member} size="xs" />
                  {member!.name.split(" ")[0]}
                  <span className="text-faint">· {n}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* tasks by status */}
        <div className="mt-6 space-y-5">
          {STATUSES.map((s) => {
            const list = grouped[s];
            if (list.length === 0) return null;
            return (
              <section key={s}>
                <div className="mb-1 flex items-center gap-2 px-2.5">
                  <span
                    className={cn("h-2 w-2 rounded-full", STATUS_META[s].dot)}
                  />
                  <span
                    className={cn(
                      "text-xs font-semibold uppercase tracking-wide",
                      STATUS_META[s].color
                    )}
                  >
                    {STATUS_META[s].label}
                  </span>
                  <span className="text-[11px] text-faint">{list.length}</span>
                </div>
                <div className="space-y-0.5">
                  {list.map((t) => (
                    <TaskRow key={t.id} task={t} showProject={false} />
                  ))}
                </div>
              </section>
            );
          })}
          {projTasks.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border py-14 text-center text-sm text-faint">
              No tasks in this project yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="card flex items-center gap-3 p-3.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2 text-muted">
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
