"use client";

import { Avatar } from "@/components/Avatar";
import { DueBadge, ProjectBadge, UrgencyBadge } from "@/components/Badges";
import { useStore } from "@/lib/store";
import {
  STATUSES,
  STATUS_META,
  type Status,
  type Task,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Clock, Link2 } from "lucide-react";
import { useMemo, useState } from "react";

export default function BoardPage() {
  const tasks = useStore((s) => s.tasks);
  const activeProject = useStore((s) => s.activeProject);
  const moveTaskStatus = useStore((s) => s.moveTaskStatus);
  const [dragId, setDragId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const visible = useMemo(
    () =>
      activeProject === "all"
        ? tasks
        : tasks.filter((t) => t.project_id === activeProject),
    [tasks, activeProject]
  );

  const columns = useMemo(() => {
    const map: Record<Status, Task[]> = {
      backlog: [],
      todo: [],
      in_progress: [],
      blocked: [],
      in_review: [],
      done: [],
    };
    for (const t of visible) map[t.status].push(t);
    for (const s of STATUSES)
      map[s].sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
    return map;
  }, [visible]);

  const activeTask = tasks.find((t) => t.id === dragId) ?? null;

  const onDragStart = (e: DragStartEvent) => setDragId(String(e.active.id));
  const onDragEnd = (e: DragEndEvent) => {
    setDragId(null);
    if (!e.over) return;
    const status = String(e.over.id) as Status;
    const taskId = String(e.active.id);
    moveTaskStatus(taskId, status);
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragId(null)}
    >
      <div className="h-full overflow-x-auto overflow-y-hidden">
        <div className="flex h-full gap-3 px-4 py-4">
          {STATUSES.map((status) => (
            <Column key={status} status={status} tasks={columns[status]} />
          ))}
        </div>
      </div>
      <DragOverlay dropAnimation={null}>
        {activeTask ? <Card task={activeTask} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({ status, tasks }: { status: Status; tasks: Task[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const meta = STATUS_META[status];
  return (
    <div className="flex h-full w-72 shrink-0 flex-col">
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className={cn("h-2.5 w-2.5 rounded-full", meta.dot)} />
        <span className="text-sm font-semibold text-fg">{meta.label}</span>
        <span className="text-xs text-faint">{tasks.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "min-h-0 flex-1 space-y-2 overflow-y-auto rounded-xl border border-transparent p-1 transition-colors",
          isOver && "border-accent/40 bg-accent-soft/40"
        )}
      >
        {tasks.map((task) => (
          <DraggableCard key={task.id} task={task} />
        ))}
        {tasks.length === 0 && (
          <div className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-faint">
            Drop here
          </div>
        )}
      </div>
    </div>
  );
}

function DraggableCard({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
  });
  const openDetail = useStore((s) => s.openDetail);
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => openDetail(task.id)}
      className={cn(
        "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-40"
      )}
    >
      <Card task={task} />
    </div>
  );
}

function Card({ task, overlay }: { task: Task; overlay?: boolean }) {
  const project = useStore((s) =>
    s.projects.find((p) => p.id === task.project_id)
  );
  const assignee = useStore((s) =>
    s.members.find((m) => m.id === task.assignee_id)
  );
  const depCount = useStore(
    (s) => s.dependencies.filter((d) => d.task_id === task.id).length
  );

  return (
    <div
      className={cn(
        "card select-none p-3 transition-shadow",
        overlay ? "shadow-pop rotate-2" : "hover:border-border-strong"
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <ProjectBadge project={project} />
        <UrgencyBadge urgency={task.urgency} />
      </div>
      <p
        className={cn(
          "text-sm font-medium leading-snug text-fg",
          task.status === "done" && "text-faint line-through"
        )}
      >
        {task.title}
      </p>
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5 text-xs text-faint">
          <DueBadge date={task.due_date} />
          {task.eta_hours ? (
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {task.eta_hours}h
            </span>
          ) : null}
          {depCount > 0 && (
            <span className="flex items-center gap-1" title="Has dependencies">
              <Link2 className="h-3.5 w-3.5" />
              {depCount}
            </span>
          )}
        </div>
        <Avatar member={assignee} size="sm" />
      </div>
    </div>
  );
}
