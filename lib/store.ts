"use client";

import { create } from "zustand";
import type {
  ActivityEntry,
  AppSettings,
  Client,
  Project,
  Status,
  Task,
  TaskDependency,
  TeamMember,
  Update,
  Urgency,
} from "./types";
import { addDays, parseDate, toISODate } from "./utils";
import { supabase } from "./supabase/client";
import { deleteRow, isRecentLocal, upsertRows } from "./supabase/persist";

import tasksData from "@/data/tasks.json";
import membersData from "@/data/team_members.json";
import projectsData from "@/data/projects.json";
import depsData from "@/data/task_dependencies.json";
import updatesData from "@/data/updates.json";
import activityData from "@/data/activity_log.json";
import clientsData from "@/data/clients.json";
import settingsData from "@/data/settings.json";

export type ProjectFilter = string | "all";

interface TaskPatch {
  title?: string;
  description?: string;
  assignee_id?: string | null;
  due_date?: string | null;
  story_points?: number | null;
  status?: Status;
  urgency?: Urgency;
  project_id?: string;
}

interface State {
  tasks: Task[];
  members: TeamMember[];
  projects: Project[];
  clients: Client[];
  dependencies: TaskDependency[];
  updates: Update[];
  activity: ActivityEntry[];
  settings: AppSettings;
  loaded: boolean;

  currentUserId: string;
  activeProject: ProjectFilter;
  selectedTaskIds: string[];
  detailTaskId: string | null;
  commandOpen: boolean;

  memberById: (id: string | null | undefined) => TeamMember | undefined;
  projectById: (id: string | null | undefined) => Project | undefined;
  clientById: (id: string | null | undefined) => Client | undefined;
  dependenciesOf: (taskId: string) => TaskDependency[];
  dependentsOf: (taskId: string) => TaskDependency[];

  hydrate: () => Promise<void>;
  subscribeRealtime: () => () => void;

  setActiveProject: (p: ProjectFilter) => void;
  updateTask: (id: string, patch: TaskPatch, source?: "ui" | "claude") => void;
  bulkUpdate: (ids: string[], patch: TaskPatch) => void;
  moveTaskStatus: (id: string, status: Status, order?: number) => void;
  addTask: (partial: Partial<Task> & { title: string }) => string;

  addMember: (partial?: Partial<TeamMember>) => string;
  updateMember: (id: string, patch: Partial<TeamMember>) => void;
  removeMember: (id: string) => void;

  addProject: (partial?: Partial<Project>) => string;
  updateProject: (id: string, patch: Partial<Project>) => void;
  removeProject: (id: string) => void;

  addClient: (partial?: Partial<Client>) => string;
  updateClient: (id: string, patch: Partial<Client>) => void;
  removeClient: (id: string) => void;

  updateSettings: (patch: Partial<AppSettings>) => void;
  setSlackConnected: (connected: boolean) => void;

  toggleSelect: (id: string) => void;
  selectMany: (ids: string[]) => void;
  clearSelection: () => void;

  openDetail: (id: string) => void;
  closeDetail: () => void;
  setCommandOpen: (open: boolean) => void;
}

const nowISO = () => new Date().toISOString();
function genId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

function buildActivity(
  task: Task,
  patch: TaskPatch,
  actorId: string,
  source: "ui" | "claude",
  at: string
): ActivityEntry[] {
  const entries: ActivityEntry[] = [];
  (Object.keys(patch) as (keyof TaskPatch)[]).forEach((field) => {
    const before = (task as unknown as Record<string, unknown>)[field];
    const after = patch[field];
    if (before === after) return;
    entries.push({
      id: genId("a"),
      task_id: task.id,
      actor_id: actorId,
      field: String(field),
      from: before === null || before === undefined ? null : String(before),
      to: after === null || after === undefined ? null : String(after),
      source,
      at,
    });
  });
  return entries;
}

/** Push dependents forward when a task's due date slips. Cascades the chain. */
function cascadeReschedule(
  tasks: Task[],
  deps: TaskDependency[],
  changedId: string,
  at: string
): { tasks: Task[]; moved: string[] } {
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
        dependent.updated_at = at;
        moved.push(dependent.id);
        queue.push(dependent.id);
      }
    }
  }
  return { tasks: Array.from(byId.values()), moved };
}

const REALTIME_MAP: Record<string, keyof State> = {
  team_members: "members",
  clients: "clients",
  projects: "projects",
  tasks: "tasks",
  updates: "updates",
  activity_log: "activity",
};

export const useStore = create<State>((set, get) => ({
  tasks: tasksData as unknown as Task[],
  members: membersData as unknown as TeamMember[],
  projects: projectsData as unknown as Project[],
  clients: clientsData as unknown as Client[],
  dependencies: depsData as unknown as TaskDependency[],
  updates: updatesData as unknown as Update[],
  activity: activityData as unknown as ActivityEntry[],
  settings: settingsData as unknown as AppSettings,
  loaded: false,

  currentUserId: "u1",
  activeProject: "all",
  selectedTaskIds: [],
  detailTaskId: null,
  commandOpen: false,

  memberById: (id) => get().members.find((m) => m.id === id),
  projectById: (id) => get().projects.find((p) => p.id === id),
  clientById: (id) => get().clients.find((c) => c.id === id),
  dependenciesOf: (taskId) =>
    get().dependencies.filter((d) => d.task_id === taskId),
  dependentsOf: (taskId) =>
    get().dependencies.filter((d) => d.depends_on_task_id === taskId),

  hydrate: async () => {
    if (!supabase || get().loaded) return;
    try {
      const [m, c, p, t, d, u, a, s] = await Promise.all([
        supabase.from("team_members").select("*"),
        supabase.from("clients").select("*"),
        supabase.from("projects").select("*"),
        supabase.from("tasks").select("*"),
        supabase.from("task_dependencies").select("*"),
        supabase.from("updates").select("*"),
        supabase.from("activity_log").select("*"),
        supabase.from("app_settings").select("*").eq("id", 1).single(),
      ]);
      const firstErr =
        m.error || c.error || p.error || t.error || d.error || u.error || a.error;
      if (firstErr) throw firstErr;
      const members = (m.data as TeamMember[]) ?? get().members;
      // Point "current user" at the real admin (bundled u1 may not exist in DB).
      const current = members.find((x) => x.id === get().currentUserId)
        ? get().currentUserId
        : members.find((x) => x.role === "admin")?.id ??
          members[0]?.id ??
          get().currentUserId;
      set({
        members,
        clients: (c.data as Client[]) ?? get().clients,
        projects: (p.data as Project[]) ?? get().projects,
        tasks: (t.data as Task[]) ?? get().tasks,
        dependencies: (d.data as TaskDependency[]) ?? get().dependencies,
        updates: (u.data as Update[]) ?? get().updates,
        activity: (a.data as ActivityEntry[]) ?? get().activity,
        settings: s.data
          ? {
              slack: (s.data as { slack: AppSettings["slack"] }).slack,
              general: (s.data as { general: AppSettings["general"] }).general,
            }
          : get().settings,
        currentUserId: current,
        loaded: true,
      });
    } catch (e) {
      console.error("[hydrate] falling back to bundled data:", e);
      set({ loaded: true });
    }
  },

  subscribeRealtime: () => {
    const sb = supabase;
    if (!sb) return () => {};
    const channel = sb.channel("vibe-realtime");
    const tables = [
      "team_members",
      "clients",
      "projects",
      "tasks",
      "task_dependencies",
      "updates",
      "activity_log",
      "app_settings",
    ];
    tables.forEach((table) => {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        (payload) => applyRealtime(set, get, table, payload)
      );
    });
    channel.subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  },

  setActiveProject: (p) => set({ activeProject: p }),

  updateTask: (id, patch, source = "ui") => {
    const state = get();
    const target = state.tasks.find((t) => t.id === id);
    if (!target) return;
    const actorId = state.currentUserId;
    const now = nowISO();

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
      withCompletion.completed_at = patch.status === "done" ? now : null;
    }

    let tasks = state.tasks.map((t) =>
      t.id === id ? { ...t, ...withCompletion, updated_at: now } : t
    );
    const entries = buildActivity(target, patch, actorId, source, now);
    let movedIds: string[] = [];
    if (dueChangedLater) {
      const r = cascadeReschedule(tasks, state.dependencies, id, now);
      tasks = r.tasks;
      movedIds = r.moved;
    }
    set({ tasks, activity: [...entries, ...state.activity] });

    const changed = new Set([id, ...movedIds]);
    upsertRows("tasks", get().tasks.filter((t) => changed.has(t.id)));
    if (entries.length) upsertRows("activity_log", entries);
  },

  bulkUpdate: (ids, patch) => {
    const state = get();
    const idSet = new Set(ids);
    const now = nowISO();
    const actorId = state.currentUserId;
    let entries: ActivityEntry[] = [];
    let tasks = state.tasks.map((t) => {
      if (!idSet.has(t.id)) return t;
      entries = [...buildActivity(t, patch, actorId, "ui", now), ...entries];
      const extra: { completed_at?: string | null } = {};
      if (patch.status && patch.status !== t.status) {
        extra.completed_at = patch.status === "done" ? now : null;
      }
      return { ...t, ...patch, ...extra, updated_at: now };
    });
    const changed = new Set(ids);
    if (patch.due_date !== undefined) {
      for (const id of ids) {
        const r = cascadeReschedule(tasks, state.dependencies, id, now);
        tasks = r.tasks;
        r.moved.forEach((mid) => changed.add(mid));
      }
    }
    set({ tasks, activity: [...entries, ...state.activity] });
    upsertRows("tasks", get().tasks.filter((t) => changed.has(t.id)));
    if (entries.length) upsertRows("activity_log", entries);
  },

  moveTaskStatus: (id, status, order) => {
    const state = get();
    const target = state.tasks.find((t) => t.id === id);
    if (!target) return;
    const now = nowISO();
    const entries =
      target.status === status
        ? []
        : buildActivity(target, { status }, state.currentUserId, "ui", now);
    const tasks = state.tasks.map((t) =>
      t.id === id
        ? {
            ...t,
            status,
            order: order ?? t.order,
            completed_at: status === "done" ? now : null,
            updated_at: now,
          }
        : t
    );
    set({ tasks, activity: [...entries, ...state.activity] });
    upsertRows("tasks", get().tasks.filter((t) => t.id === id));
    if (entries.length) upsertRows("activity_log", entries);
  },

  addTask: (partial) => {
    const id = genId("t");
    const now = nowISO();
    const state = get();
    const task: Task = {
      id,
      project_id:
        partial.project_id ??
        (state.activeProject !== "all"
          ? state.activeProject
          : state.projects[0]?.id) ??
        "",
      title: partial.title,
      description: partial.description ?? "",
      assignee_id: partial.assignee_id ?? state.currentUserId,
      due_date: partial.due_date ?? null,
      story_points: partial.story_points ?? null,
      status: partial.status ?? "todo",
      urgency: partial.urgency ?? "medium",
      order: 0,
      created_by: state.currentUserId,
      completed_at: null,
      created_at: now,
      updated_at: now,
    };
    set({ tasks: [task, ...state.tasks] });
    upsertRows("tasks", [task]);
    return id;
  },

  addMember: (partial) => {
    const id = genId("u");
    const member: TeamMember = {
      id,
      name: partial?.name ?? "New member",
      email: partial?.email ?? "",
      avatar: null,
      role: partial?.role ?? "member",
      lead_id: partial?.lead_id ?? null,
      slack_user_id: partial?.slack_user_id ?? "",
      timezone: partial?.timezone ?? "Asia/Kolkata",
    };
    set((state) => ({ members: [...state.members, member] }));
    upsertRows("team_members", [member]);
    return id;
  },

  updateMember: (id, patch) => {
    const state = get();
    let members = state.members.map((m) =>
      m.id === id ? { ...m, ...patch } : m
    );
    const detached: TeamMember[] = [];
    if (patch.role && patch.role !== "team_lead") {
      members = members.map((m) => {
        if (m.lead_id === id) {
          const next = { ...m, lead_id: null };
          detached.push(next);
          return next;
        }
        return m;
      });
    }
    set({ members });
    const updated = members.find((m) => m.id === id);
    upsertRows("team_members", [updated!, ...detached]);
  },

  removeMember: (id) => {
    const state = get();
    const members = state.members
      .filter((m) => m.id !== id)
      .map((m) => (m.lead_id === id ? { ...m, lead_id: null } : m));
    const tasks = state.tasks.map((t) =>
      t.assignee_id === id ? { ...t, assignee_id: null } : t
    );
    const affectedMembers = members.filter(
      (m) => state.members.find((o) => o.id === m.id)?.lead_id === id
    );
    const affectedTasks = tasks.filter((t) => {
      const prev = state.tasks.find((o) => o.id === t.id);
      return prev?.assignee_id === id;
    });
    set({ members, tasks });
    if (affectedMembers.length) upsertRows("team_members", affectedMembers);
    if (affectedTasks.length) upsertRows("tasks", affectedTasks);
    deleteRow("team_members", { id });
  },

  addProject: (partial) => {
    const id = genId("p");
    const state = get();
    const project: Project = {
      id,
      name: partial?.name ?? "New project",
      owner_id: partial?.owner_id ?? state.currentUserId,
      client_id: partial?.client_id ?? null,
      status: partial?.status ?? "active",
      color: partial?.color ?? "indigo",
      slack_channel_id: partial?.slack_channel_id ?? null,
      target_date: partial?.target_date ?? null,
    };
    set({ projects: [...state.projects, project] });
    upsertRows("projects", [project]);
    return id;
  },

  updateProject: (id, patch) => {
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, ...patch } : p
      ),
    }));
    const updated = get().projects.find((p) => p.id === id);
    if (updated) upsertRows("projects", [updated]);
  },

  removeProject: (id) => {
    set((state) => {
      const taskIds = new Set(
        state.tasks.filter((t) => t.project_id === id).map((t) => t.id)
      );
      return {
        projects: state.projects.filter((p) => p.id !== id),
        tasks: state.tasks.filter((t) => t.project_id !== id),
        dependencies: state.dependencies.filter(
          (d) => !taskIds.has(d.task_id) && !taskIds.has(d.depends_on_task_id)
        ),
      };
    });
    // DB cascade removes the project's tasks/deps/activity.
    deleteRow("projects", { id });
  },

  addClient: (partial) => {
    const id = genId("c");
    const client: Client = {
      id,
      name: partial?.name ?? "New client",
      contact_name: partial?.contact_name ?? "",
      contact_email: partial?.contact_email ?? "",
      status: partial?.status ?? "active",
      color: partial?.color ?? "sky",
      created_at: nowISO(),
    };
    set((state) => ({ clients: [...state.clients, client] }));
    upsertRows("clients", [client]);
    return id;
  },

  updateClient: (id, patch) => {
    set((state) => ({
      clients: state.clients.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
    const updated = get().clients.find((c) => c.id === id);
    if (updated) upsertRows("clients", [updated]);
  },

  removeClient: (id) => {
    const state = get();
    const affected = state.projects
      .filter((p) => p.client_id === id)
      .map((p) => ({ ...p, client_id: null }));
    set({
      clients: state.clients.filter((c) => c.id !== id),
      projects: state.projects.map((p) =>
        p.client_id === id ? { ...p, client_id: null } : p
      ),
    });
    if (affected.length) upsertRows("projects", affected);
    deleteRow("clients", { id });
  },

  updateSettings: (patch) => {
    set((state) => ({ settings: { ...state.settings, ...patch } }));
    const s = get().settings;
    upsertRows("app_settings", [{ id: 1, slack: s.slack, general: s.general }]);
  },

  setSlackConnected: (connected) => {
    set((state) => ({
      settings: {
        ...state.settings,
        slack: { ...state.settings.slack, connected },
      },
    }));
    const s = get().settings;
    upsertRows("app_settings", [{ id: 1, slack: s.slack, general: s.general }]);
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

type RealtimePayload = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Record<string, unknown> | null;
  old: Record<string, unknown> | null;
};

function applyRealtime(
  set: (partial: Partial<State>) => void,
  get: () => State,
  table: string,
  payload: RealtimePayload
) {
  const row = (payload.new ?? payload.old) as Record<string, unknown> | null;
  if (!row) return;

  if (table === "app_settings") {
    if (isRecentLocal("app_settings:1")) return;
    const nu = payload.new as { slack?: unknown; general?: unknown } | null;
    if (nu) {
      set({
        settings: {
          slack: nu.slack as AppSettings["slack"],
          general: nu.general as AppSettings["general"],
        },
      });
    }
    return;
  }

  if (table === "task_dependencies") {
    const key = `task_dependencies:${row.task_id}|${row.depends_on_task_id}`;
    if (isRecentLocal(key)) return;
    const deps = get().dependencies;
    if (payload.eventType === "DELETE") {
      set({
        dependencies: deps.filter(
          (d) =>
            !(
              d.task_id === row.task_id &&
              d.depends_on_task_id === row.depends_on_task_id
            )
        ),
      });
    } else {
      const exists = deps.some(
        (d) =>
          d.task_id === row.task_id &&
          d.depends_on_task_id === row.depends_on_task_id
      );
      set({
        dependencies: exists ? deps : [...deps, row as unknown as TaskDependency],
      });
    }
    return;
  }

  const field = REALTIME_MAP[table];
  if (!field) return;
  const id = row.id as string;
  if (isRecentLocal(`${table}:${id}`)) return;
  const list = get()[field] as unknown as { id: string }[];

  if (payload.eventType === "DELETE") {
    set({ [field]: list.filter((r) => r.id !== id) } as unknown as Partial<State>);
  } else {
    const idx = list.findIndex((r) => r.id === id);
    const next =
      idx === -1
        ? [row as unknown as { id: string }, ...list]
        : list.map((r) => (r.id === id ? (row as unknown as { id: string }) : r));
    set({ [field]: next } as unknown as Partial<State>);
  }
}
