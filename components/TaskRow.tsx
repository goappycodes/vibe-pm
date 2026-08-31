"use client";

import { memo } from "react";
import { useStore } from "@/lib/store";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Avatar } from "./Avatar";
import {
  CycleBadge,
  DueBadge,
  PointsBadge,
  ProjectBadge,
  UrgencyBadge,
} from "./Badges";
import { StatusPicker } from "./Pickers";

export const TaskRow = memo(function TaskRow({
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
  const timing = useStore((s) => s.runningTimer?.taskId === task.id);

  const done = task.status === "done";

  return (
    <div className="group flex items-center gap-3 rounded-xl border border-transparent px-2.5 py-2 transition-colors hover:border-border hover:bg-surface">
      <StatusPicker
        value={task.status}
        onChange={(s) => updateTask(task.id, { status: s })}
      />
      {timing && (
        <span
          className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-emerald-500"
          title="Timer running"
        />
      )}

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

      {task.story_points != null ? (
        <div className="hidden md:block">
          <PointsBadge points={task.story_points} />
        </div>
      ) : null}

      <div className="hidden sm:block">
        <UrgencyBadge urgency={task.urgency} />
      </div>

      <div className="flex w-20 justify-end">
        {done ? (
          <CycleBadge
            createdAt={task.created_at}
            completedAt={task.completed_at}
          />
        ) : (
          <DueBadge date={task.due_date} />
        )}
      </div>

      <Avatar member={assignee} size="sm" />
    </div>
  );
});
