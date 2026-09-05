"use client";

import { Avatar } from "@/components/Avatar";
import {
  CycleBadge,
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
  closestCenter,
  getFirstCollision,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
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
import { MenuItem, Popover } from "@/components/Popover";
import { ChevronDown, Link2, Plus, Search, X } from "lucide-react";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useQueryState } from "@/lib/useUrlState";

type Columns = Record<Status, string[]>;

function emptyColumns(): Columns {
  return {
    backlog: [],
    todo: [],
    in_progress: [],
    blocked: [],
    in_review: [],
    done: [],
  };
}

function buildColumns(tasks: Task[]): Columns {
  const map = emptyColumns();
  const sorted = [...tasks].sort(
    (a, b) => a.order - b.order || a.title.localeCompare(b.title)
  );
  for (const t of sorted) map[t.status].push(t.id);
  return map;
}

const isStatus = (id: string): id is Status =>
  (STATUSES as string[]).includes(id);

function findContainer(items: Columns, id: string): Status | undefined {
  if (isStatus(id)) return id;
  return STATUSES.find((s) => items[s].includes(id));
}

export default function BoardPage() {
  const tasks = useStore((s) => s.tasks);
  const members = useStore((s) => s.members);
  const currentUserId = useStore((s) => s.currentUserId);
  const activeProject = useStore((s) => s.activeProject);
  const moveTaskStatus = useStore((s) => s.moveTaskStatus);
  const reorderColumn = useStore((s) => s.reorderColumn);

  const [query, setQuery] = useQueryState("q", ""); // shareable in the URL
  // The board opens on your own cards — it's a working queue, not a report.
  // `currentUserId` only settles once the session and members have loaded, so
  // track it until someone picks a filter for themselves.
  const [assigneeFilter, setAssigneeFilter] = useState<string>(currentUserId);
  const pickedFilter = useRef(false);
  useEffect(() => {
    if (!pickedFilter.current) setAssigneeFilter(currentUserId);
  }, [currentUserId]);
  const pickAssignee = useCallback((id: string) => {
    pickedFilter.current = true;
    setAssigneeFilter(id);
  }, []);
  const hasFilters = query.trim() !== "" || assigneeFilter !== "all";

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (
      activeProject === "all"
        ? tasks
        : tasks.filter((t) => t.project_id === activeProject)
    ).filter((t) => {
      if (q && !t.title.toLowerCase().includes(q)) return false;
      if (assigneeFilter === "unassigned" && t.assignee_id) return false;
      if (
        assigneeFilter !== "all" &&
        assigneeFilter !== "unassigned" &&
        t.assignee_id !== assigneeFilter
      )
        return false;
      return true;
    });
  }, [tasks, activeProject, query, assigneeFilter]);
  const tasksById = useMemo(() => {
    const m = new Map<string, Task>();
    for (const t of tasks) m.set(t.id, t);
    return m;
  }, [tasks]);

  // Columns derived straight from the store — the source of truth when idle.
  const derived = useMemo(() => buildColumns(visible), [visible]);

  // During a drag we operate on a clone; null means "use derived".
  const [dragItems, setDragItems] = useState<Columns | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const items = dragItems ?? derived;

  const lastOverId = useRef<string | null>(null);
  const recentlyMoved = useRef(false);

  useEffect(() => {
    requestAnimationFrame(() => {
      recentlyMoved.current = false;
    });
  }, [dragItems]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  // Collision strategy that avoids the cross-container oscillation loop.
  const collisionDetection: CollisionDetection = useCallback(
    (args) => {
      const pointer = pointerWithin(args);
      const intersections = pointer.length ? pointer : rectIntersection(args);
      let overId = getFirstCollision(intersections, "id");

      if (overId != null) {
        const overStr = String(overId);
        if (isStatus(overStr)) {
          const containerItems = items[overStr];
          if (containerItems.length > 0) {
            const closest = closestCenter({
              ...args,
              droppableContainers: args.droppableContainers.filter(
                (c) =>
                  String(c.id) !== overStr &&
                  containerItems.includes(String(c.id))
              ),
            });
            if (closest.length) overId = closest[0].id;
          }
        }
        lastOverId.current = String(overId);
        return [{ id: overId }];
      }

      if (recentlyMoved.current) lastOverId.current = activeId;
      return lastOverId.current ? [{ id: lastOverId.current }] : [];
    },
    [activeId, items]
  );

  const reset = () => {
    setDragItems(null);
    setActiveId(null);
  };

  const onDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
    setDragItems(derived);
  };

  const onDragOver = (e: DragOverEvent) => {
    const overId = e.over ? String(e.over.id) : null;
    if (!overId) return;
    const activeId = String(e.active.id);
    const activeC = findContainer(items, activeId);
    const overC = findContainer(items, overId);
    if (!activeC || !overC || activeC === overC) return;

    setDragItems((prev) => {
      const base = prev ?? derived;
      const activeItems = base[activeC];
      const overItems = base[overC];
      const overIndex = isStatus(overId)
        ? overItems.length
        : overItems.indexOf(overId);
      const insertAt = overIndex >= 0 ? overIndex : overItems.length;
      recentlyMoved.current = true;
      return {
        ...base,
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
    const current = dragItems ?? derived;
    const container = findContainer(current, id);
    if (!container || !overId) {
      reset();
      return;
    }

    let cols = current;
    const overC = findContainer(current, overId);
    if (overC === container && overId !== id) {
      const oldIndex = current[container].indexOf(id);
      const newIndex = isStatus(overId)
        ? current[container].length - 1
        : current[container].indexOf(overId);
      if (oldIndex !== newIndex && newIndex >= 0) {
        cols = {
          ...current,
          [container]: arrayMove(current[container], oldIndex, newIndex),
        };
      }
    }

    const task = tasksById.get(id);
    if (task && task.status !== container) moveTaskStatus(id, container);
    reorderColumn(container, cols[container]);
    reset();
  };

  const activeTask = activeId ? tasksById.get(activeId) : null;
  const activeAssignee = members.find((m) => m.id === assigneeFilter);
  const visibleCount = visible.length;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={reset}
    >
      <div className="flex h-full flex-col">
        {/* filter toolbar */}
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2">
          <div className="relative w-56 max-w-full">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search cards…"
              className="w-full rounded-lg border border-border bg-surface py-1.5 pl-8 pr-7 text-sm text-fg outline-none placeholder:text-faint focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-faint hover:text-fg"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <button
            onClick={() =>
              pickAssignee(assigneeFilter === currentUserId ? "all" : currentUserId)
            }
            className={cn(
              "btn-outline",
              assigneeFilter === currentUserId && "border-accent text-accent"
            )}
          >
            Only mine
          </button>

          <Popover
            width={220}
            trigger={({ toggle }) => (
              <button onClick={toggle} className="btn-outline gap-1.5">
                {assigneeFilter === "all"
                  ? "Assignee"
                  : assigneeFilter === "unassigned"
                    ? "Unassigned"
                    : (activeAssignee?.name.split(" ")[0] ?? "Assignee")}
                <ChevronDown className="h-3.5 w-3.5 text-faint" />
              </button>
            )}
          >
            {(close) => (
              <div className="max-h-72 overflow-y-auto py-1">
                <MenuItem
                  active={assigneeFilter === "all"}
                  onClick={() => {
                    pickAssignee("all");
                    close();
                  }}
                >
                  <span className="flex-1">Anyone</span>
                </MenuItem>
                <MenuItem
                  active={assigneeFilter === "unassigned"}
                  onClick={() => {
                    pickAssignee("unassigned");
                    close();
                  }}
                >
                  <span className="flex-1 text-muted">Unassigned</span>
                </MenuItem>
                {members
                  .filter((m) => tasks.some((t) => t.assignee_id === m.id))
                  .map((m) => (
                    <MenuItem
                      key={m.id}
                      active={assigneeFilter === m.id}
                      onClick={() => {
                        pickAssignee(m.id);
                        close();
                      }}
                    >
                      <Avatar member={m} size="sm" />
                      <span className="flex-1 truncate">{m.name}</span>
                    </MenuItem>
                  ))}
              </div>
            )}
          </Popover>

          <span className="ml-auto text-xs text-faint">
            {visibleCount} {visibleCount === 1 ? "card" : "cards"}
          </span>
          {hasFilters && (
            <button
              onClick={() => {
                setQuery("");
                pickAssignee("all");
              }}
              className="btn-ghost gap-1 text-xs text-muted"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </button>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
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
      </div>
      <DragOverlay
        dropAnimation={{ duration: 180, easing: "cubic-bezier(0.2,0,0,1)" }}
      >
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
  const addTask = useStore((s) => s.addTask);
  const activeProject = useStore((s) => s.activeProject);
  const projects = useStore((s) => s.projects);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  const submit = () => {
    const title = draft.trim();
    if (!title) return;
    addTask({ title, status });
    setDraft("");
    inputRef.current?.focus();
  };

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
              <SortableCard key={id} task={task} dragging={activeId === id} />
            );
          })}
          {ids.length === 0 && !adding && (
            <div className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-faint">
              Drop here
            </div>
          )}
        </div>
      </SortableContext>

      <div className="mt-1 p-1">
        {adding ? (
          <div className="rounded-xl border border-border bg-surface p-2 shadow-soft">
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                } else if (e.key === "Escape") {
                  setAdding(false);
                  setDraft("");
                }
              }}
              rows={2}
              placeholder="Task title…"
              className="w-full resize-none bg-transparent text-sm text-fg outline-none placeholder:text-faint"
            />
            <div className="mt-1 flex items-center gap-1.5">
              <button
                onClick={submit}
                disabled={!draft.trim()}
                className="btn-primary py-1 text-xs disabled:opacity-40"
              >
                Add task
              </button>
              <button
                onClick={() => {
                  setAdding(false);
                  setDraft("");
                }}
                className="btn-ghost h-7 w-7 p-0"
                aria-label="Cancel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-faint transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <Plus className="h-4 w-4" />
            Add task
          </button>
        )}
      </div>
    </div>
  );
}

function SortableCard({ task, dragging }: { task: Task; dragging: boolean }) {
  const openDetail = useStore((s) => s.openDetail);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });

  const style = { transform: CSS.Translate.toString(transform), transition };

  if (isDragging || dragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="h-[92px] rounded-xl border-2 border-dashed border-accent/40 bg-accent-soft/30"
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

const Card = memo(function Card({
  task,
  overlay,
}: {
  task: Task;
  overlay?: boolean;
}) {
  const project = useStore((s) =>
    s.projects.find((p) => p.id === task.project_id)
  );
  const assignee = useStore((s) =>
    s.members.find((m) => m.id === task.assignee_id)
  );
  const depCount = useStore(
    (s) => s.dependencies.filter((d) => d.task_id === task.id).length
  );
  const timing = useStore((s) => s.runningTimer?.taskId === task.id);

  return (
    <div
      className={cn(
        "card select-none p-3 transition-shadow",
        overlay ? "rotate-2 shadow-pop" : "hover:border-border-strong"
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          {timing && (
            <span
              className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-emerald-500"
              title="Timer running"
            />
          )}
          <ProjectBadge project={project} />
        </div>
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
          {task.status === "done" ? (
            <CycleBadge
              createdAt={task.created_at}
              completedAt={task.completed_at}
            />
          ) : (
            <DueBadge date={task.due_date} />
          )}
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
});
