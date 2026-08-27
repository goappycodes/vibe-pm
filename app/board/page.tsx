"use client";

import { Avatar } from "@/components/Avatar";
import {
  DueBadge,
  PointsBadge,
  ProjectBadge,
  UrgencyBadge,
} from "@/components/Badges";
import { useStore } from "@/lib/store";
import { STATUSES, STATUS_META, type Status, type Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from "@dnd-kit/core";
import { Link2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Columns = Record<Status, string[]>;

function buildColumns(tasks: Task[]): Columns {
  const map: Columns = {
    backlog: [],
    todo: [],
    in_progress: [],
    blocked: [],
    in_review: [],
    done: [],
  };
  const sorted = [...tasks].sort(
    (a, b) => a.order - b.order || a.title.localeCompare(b.title)
  );
  for (const t of sorted) map[t.status].push(t.id);
  return map;
}

export default function BoardPage() {
  const tasks = useStore((s) => s.tasks);
  const activeProject = useStore((s) => s.activeProject);
  const moveTaskStatus = useStore((s) => s.moveTaskStatus);
  const reorderColumn = useStore((s) => s.reorderColumn);

  const visible = useMemo(
    () =>
      activeProject === "all"
        ? tasks
        : tasks.filter((t) => t.project_id === activeProject),
    [tasks, activeProject]
  );
  const tasksById = useMemo(() => {
    const m = new Map<string, Task>();
    for (const t of tasks) m.set(t.id, t);
    return m;
  }, [tasks]);

  const [items, setItems] = useState<Columns>(() => buildColumns(visible));
  const [activeId, setActiveId] = useState<string | null>(null);

  // Keep local column state in sync with the store while not dragging.
  useEffect(() => {
    if (!activeId) setItems(buildColumns(visible));
  }, [visible, activeId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const findContainer = (id: string): Status | undefined => {
    if (id in items) return id as Status;
    return STATUSES.find((s) => items[s].includes(id));
  };

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const onDragOver = (e: DragOverEvent) => {
    const activeId = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    if (!overId) return;
    const activeC = findContainer(activeId);
    const overC = findContainer(overId);
    if (!activeC || !overC || activeC === overC) return;

    setItems((prev) => {
      const activeItems = prev[activeC];
      const overItems = prev[overC];
      const overIndex =
        overId in prev ? overItems.length : overItems.indexOf(overId);
      const insertAt = overIndex >= 0 ? overIndex : overItems.length;
      return {
        ...prev,
        [activeC]: activeItems.filter((id) => id !== activeId),
        [overC]: [
          ...overItems.slice(0, insertAt),
          activeId,
          ...overItems.slice(insertAt),
        ],
      };
    });
  };

  const onDragEnd = (e: DragEndEvent) => {
    const id = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    const container = findContainer(id);
    setActiveId(null);
    if (!container || !overId) return;

    let next = items;
    const overC = findContainer(overId);
    if (overC === container && overId !== id) {
      const oldIndex = items[container].indexOf(id);
      const newIndex =
        overId in items
          ? items[container].length - 1
          : items[container].indexOf(overId);
      if (oldIndex !== newIndex && newIndex >= 0) {
        next = {
          ...items,
          [container]: arrayMove(items[container], oldIndex, newIndex),
        };
        setItems(next);
      }
    }

    const task = tasksById.get(id);
    if (task && task.status !== container) moveTaskStatus(id, container);
    reorderColumn(container, next[container]);
  };

  const activeTask = activeId ? tasksById.get(activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="h-full overflow-x-auto overflow-y-hidden">
        <div className="flex h-full gap-3 px-4 py-4">
          {STATUSES.map((status) => (
            <Column
              key={status}
              status={status}
              ids={items[status]}
              tasksById={tasksById}
              activeId={activeId}
            />
          ))}
        </div>
      </div>
      <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.2,0,0,1)" }}>
        {activeTask ? <Card task={activeTask} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  status,
  ids,
  tasksById,
  activeId,
}: {
  status: Status;
  ids: string[];
  tasksById: Map<string, Task>;
  activeId: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const meta = STATUS_META[status];
  return (
    <div className="flex h-full w-72 shrink-0 flex-col">
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className={cn("h-2.5 w-2.5 rounded-full", meta.dot)} />
        <span className="text-sm font-semibold text-fg">{meta.label}</span>
        <span className="text-xs text-faint">{ids.length}</span>
      </div>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={cn(
            "min-h-0 flex-1 space-y-2 overflow-y-auto rounded-xl border border-transparent p-1 transition-colors",
            isOver && "border-accent/40 bg-accent-soft/40"
          )}
        >
          {ids.map((id) => {
            const task = tasksById.get(id);
            if (!task) return null;
            return (
              <SortableCard
                key={id}
                task={task}
                dragging={activeId === id}
              />
            );
          })}
          {ids.length === 0 && (
            <div className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-faint">
              Drop here
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

function SortableCard({ task, dragging }: { task: Task; dragging: boolean }) {
  const openDetail = useStore((s) => s.openDetail);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  // The slot left behind by the lifted card becomes a dashed placeholder —
  // the "space" the card will drop into (Trello-style).
  if (isDragging || dragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="h-[74px] rounded-xl border-2 border-dashed border-accent/40 bg-accent-soft/30"
      />
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => openDetail(task.id)}
      className="cursor-grab touch-none active:cursor-grabbing"
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
        overlay ? "rotate-2 shadow-pop" : "hover:border-border-strong"
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
          <PointsBadge points={task.story_points} />
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
