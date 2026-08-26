"use client";

import { useStore } from "@/lib/store";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Clock } from "lucide-react";
import { Avatar } from "./Avatar";
import { DueBadge, ProjectBadge, UrgencyBadge } from "./Badges";
import { StatusPicker } from "./Pickers";

export function TaskRow({
  task,
  showProject = true,
}: {
  task: Task;
  showProject?: boolean;
}) {
  const updateTask = useStore((s) => s.updateTask);
  const openDetail = useStore((s) => s.openDetail);
  const project = useStore((s) => s.projects.find((p) => p.id === task.project_id));
  const assignee = useStore((s) =>
    s.members.find((m) => m.id === task.assignee_id)
  );

  const done = task.status === "done";

  return (
    <div className="group flex items-center gap-3 rounded-xl border border-transparent px-2.5 py-2 transition-colors hover:border-border hover:bg-surface">
      <StatusPicker
        value={task.status}
        onChange={(s) => updateTask(task.id, { status: s })}
      />

      <button
        onClick={() => openDetail(task.id)}
        className="min-w-0 flex-1 text-left"
      >
        <div
          className={cn(
            "truncate text-sm font-medium text-fg",
            done && "text-faint line-through"
          )}
        >
          {task.title}
        </div>
        {showProject && (
          <div className="mt-0.5 flex items-center gap-2">
            <ProjectBadge project={project} />
          </div>
        )}
      </button>

      {task.eta_hours ? (
        <span className="hidden items-center gap-1 text-xs text-faint md:flex">
          <Clock className="h-3.5 w-3.5" />
          {task.eta_hours}h
        </span>
      ) : null}

      <div className="hidden sm:block">
        <UrgencyBadge urgency={task.urgency} />
      </div>

      <div className="w-16 text-right">
        <DueBadge date={task.due_date} />
      </div>

      <Avatar member={assignee} size="sm" />
    </div>
  );
}
