"use client";

import { create } from "zustand";
import type {
  ActivityEntry,
  Project,
  Status,
  Task,
  TaskDependency,
  TeamMember,
  Update,
  Urgency,
} from "./types";
import { addDays, parseDate, toISODate } from "./utils";

import tasksData from "@/data/tasks.json";
import membersData from "@/data/team_members.json";
import projectsData from "@/data/projects.json";
import depsData from "@/data/task_dependencies.json";
import updatesData from "@/data/updates.json";
import activityData from "@/data/activity_log.json";

export type ProjectFilter = string | "all";

interface TaskPatch {
  title?: string;
  description?: string;
  assignee_id?: string | null;
  due_date?: string | null;
  eta_hours?: number | null;
  status?: Status;
  urgency?: Urgency;
  project_id?: string;
}

interface State {
  tasks: Task[];
  members: TeamMember[];
  projects: Project[];
  dependencies: TaskDependency[];
  updates: Update[];
  activity: ActivityEntry[];

  currentUserId: string;
  activeProject: ProjectFilter;
  selectedTaskIds: string[];
  detailTaskId: string | null;
  commandOpen: boolean;

  // derived helpers
  memberById: (id: string | null | undefined) => TeamMember | undefined;
  projectById: (id: string | null | undefined) => Project | undefined;
  dependenciesOf: (taskId: string) => TaskDependency[];
  dependentsOf: (taskId: string) => TaskDependency[];

  // actions
  setActiveProject: (p: ProjectFilter) => void;
  updateTask: (id: string, patch: TaskPatch, source?: "ui" | "claude") => void;
  bulkUpdate: (ids: string[], patch: TaskPatch) => void;
  moveTaskStatus: (id: string, status: Status, order?: number) => void;
  addTask: (partial: Partial<Task> & { title: string }) => string;

  toggleSelect: (id: string) => void;
  selectMany: (ids: string[]) => void;
  clearSelection: () => void;

  openDetail: (id: string) => void;
  closeDetail: () => void;
  setCommandOpen: (open: boolean) => void;
}

let activitySeq = activityData.length;
function nextActivityId() {
  activitySeq += 1;
  return `a_local_${activitySeq}`;
}

let taskSeq = tasksData.length;
function nextTaskId() {
  taskSeq += 1;
  return `t_local_${taskSeq}`;
}

// A fixed clock so mock timestamps stay deterministic.
const NOW_ISO = "2026-08-26T10:00:00Z";

function logActivity(
  list: ActivityEntry[],
  task: Task,
  patch: TaskPatch,
  actorId: string,
  source: "ui" | "claude"
): ActivityEntry[] {
  const entries: ActivityEntry[] = [];
  (Object.keys(patch) as (keyof TaskPatch)[]).forEach((field) => {
    const before = (task as unknown as Record<string, unknown>)[field];
    const after = patch[field];
    if (before === after) return;
    entries.push({
      id: nextActivityId(),
      task_id: task.id,
      actor_id: actorId,
      field: String(field),
      from: before === null || before === undefined ? null : String(before),
      to: after === null || after === undefined ? null : String(after),
      source,
      at: NOW_ISO,
    });
  });
  return [...entries.reverse(), ...list];
}

/**
 * When a task's due date moves later, push any dependents forward so they never
 * start before the thing they depend on finishes. Cascades along the chain.
 */
function cascadeReschedule(tasks: Task[], deps: TaskDependency[], changedId: string): {
  tasks: Task[];
  moved: string[];
} {
  const byId = new Map(tasks.map((t) => [t.id, { ...t }]));
  const moved: string[] = [];
  const queue = [changedId];

  while (queue.length) {
    const currentId = queue.shift()!;
    const current = byId.get(currentId);
    if (!current || !current.due_date) continue;
    const currentDue = parseDate(current.due_date);
    if (!currentDue) continue;

    const dependents = deps.filter((d) => d.depends_on_task_id === currentId);
    for (const dep of dependents) {
      const dependent = byId.get(dep.task_id);
      if (!dependent) continue;
      const depDue = parseDate(dependent.due_date);
      const minStart = addDays(currentDue, 1);
      if (!depDue || depDue < minStart) {
        dependent.due_date = toISODate(minStart);
        dependent.updated_at = NOW_ISO;
        moved.push(dependent.id);
        queue.push(dependent.id);
      }
    }
  }

  return { tasks: Array.from(byId.values()), moved };
}

export const useStore = create<State>((set, get) => ({
  tasks: tasksData as unknown as Task[],
  members: membersData as unknown as TeamMember[],
  projects: projectsData as unknown as Project[],
  dependencies: depsData as unknown as TaskDependency[],
  updates: updatesData as unknown as Update[],
  activity: activityData as unknown as ActivityEntry[],

  currentUserId: "u1",
  activeProject: "all",
  selectedTaskIds: [],
  detailTaskId: null,
  commandOpen: false,

  memberById: (id) => get().members.find((m) => m.id === id),
  projectById: (id) => get().projects.find((p) => p.id === id),
  dependenciesOf: (taskId) =>
    get().dependencies.filter((d) => d.task_id === taskId),
  dependentsOf: (taskId) =>
    get().dependencies.filter((d) => d.depends_on_task_id === taskId),

  setActiveProject: (p) => set({ activeProject: p }),

  updateTask: (id, patch, source = "ui") =>
    set((state) => {
      const actorId = state.currentUserId;
      const target = state.tasks.find((t) => t.id === id);
      if (!target) return state;

      const dueChangedLater =
        patch.due_date !== undefined &&
        patch.due_date !== target.due_date &&
        (() => {
          const before = parseDate(target.due_date);
          const after = parseDate(patch.due_date ?? null);
          return !!after && (!before || after > before);
        })();

      const withCompletion: TaskPatch & { completed_at?: string | null } = {
        ...patch,
      };
      if (patch.status && patch.status !== target.status) {
        withCompletion.completed_at =
          patch.status === "done" ? NOW_ISO : null;
      }

      let tasks = state.tasks.map((t) =>
        t.id === id
          ? { ...t, ...withCompletion, updated_at: NOW_ISO }
          : t
      );

      const activity = logActivity(state.activity, target, patch, actorId, source);

      if (dueChangedLater) {
        const result = cascadeReschedule(tasks, state.dependencies, id);
        tasks = result.tasks;
      }

      return { tasks, activity };
    }),

  bulkUpdate: (ids, patch) =>
    set((state) => {
      const idSet = new Set(ids);
      let activity = state.activity;
      const actorId = state.currentUserId;
      let tasks = state.tasks.map((t) => {
        if (!idSet.has(t.id)) return t;
        activity = logActivity(activity, t, patch, actorId, "ui");
        const extra: { completed_at?: string | null } = {};
        if (patch.status && patch.status !== t.status) {
          extra.completed_at = patch.status === "done" ? NOW_ISO : null;
        }
        return { ...t, ...patch, ...extra, updated_at: NOW_ISO };
      });

      if (patch.due_date !== undefined) {
        for (const id of ids) {
          tasks = cascadeReschedule(tasks, state.dependencies, id).tasks;
        }
      }
      return { tasks, activity };
    }),

  moveTaskStatus: (id, status, order) =>
    set((state) => {
      const target = state.tasks.find((t) => t.id === id);
      if (!target) return state;
      const activity =
        target.status === status
          ? state.activity
          : logActivity(state.activity, target, { status }, state.currentUserId, "ui");
      const tasks = state.tasks.map((t) =>
        t.id === id
          ? {
              ...t,
              status,
              order: order ?? t.order,
              completed_at: status === "done" ? NOW_ISO : null,
              updated_at: NOW_ISO,
            }
          : t
      );
      return { tasks, activity };
    }),

  addTask: (partial) => {
    const id = nextTaskId();
    set((state) => {
      const task: Task = {
        id,
        project_id:
          partial.project_id ??
          (state.activeProject !== "all"
            ? state.activeProject
            : state.projects[0].id),
        title: partial.title,
        description: partial.description ?? "",
        assignee_id: partial.assignee_id ?? state.currentUserId,
        due_date: partial.due_date ?? null,
        eta_hours: partial.eta_hours ?? null,
        status: partial.status ?? "todo",
        urgency: partial.urgency ?? "medium",
        order: 0,
        created_by: state.currentUserId,
        completed_at: null,
        created_at: NOW_ISO,
        updated_at: NOW_ISO,
      };
      return { tasks: [task, ...state.tasks] };
    });
    return id;
  },

  toggleSelect: (id) =>
    set((state) => ({
      selectedTaskIds: state.selectedTaskIds.includes(id)
        ? state.selectedTaskIds.filter((x) => x !== id)
        : [...state.selectedTaskIds, id],
    })),
  selectMany: (ids) => set({ selectedTaskIds: ids }),
  clearSelection: () => set({ selectedTaskIds: [] }),

  openDetail: (id) => set({ detailTaskId: id }),
  closeDetail: () => set({ detailTaskId: null }),
  setCommandOpen: (open) => set({ commandOpen: open }),
}));
