"use client";

import { create } from "zustand";
import type {
  ActivityEntry,
  AppSettings,
  Attachment,
  Client,
  Comment,
  DaySelection,
  Project,
  Status,
  Task,
  TaskDependency,
  TeamMember,
  TimeLog,
  Update,
  UpdateSource,
  Urgency,
} from "./types";
import {
  addDays,
  minutesBetween,
  parseDate,
  TODAY,
  toISODate,
} from "./utils";
import { supabase } from "./supabase/client";
import { deleteRow, isRecentLocal, upsertRows } from "./supabase/persist";

import tasksData from "@/data/tasks.json";
import membersData from "@/data/team_members.json";
import projectsData from "@/data/projects.json";
import depsData from "@/data/task_dependencies.json";
import updatesData from "@/data/updates.json";
import activityData from "@/data/activity_log.json";
import clientsData from "@/data/clients.json";
import commentsData from "@/data/comments.json";
import attachmentsData from "@/data/attachments.json";
import daySelectionsData from "@/data/day_selections.json";
import timeLogsData from "@/data/time_logs.json";
import settingsData from "@/data/settings.json";

export type ProjectFilter = string | "all";

export interface TimeLogInput {
  project_id: string | null;
  task_id: string | null;
  date: string;
  start_time: string;
  end_time: string;
  note?: string;
  user_id?: string;
}

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
  comments: Comment[];
  attachments: Attachment[];
  daySelections: DaySelection[];
  timeLogs: TimeLog[];
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
  reorderColumn: (status: Status, orderedIds: string[]) => void;
  addTask: (partial: Partial<Task> & { title: string }) => string;
  deleteTask: (id: string) => void;
  bulkDelete: (ids: string[]) => void;
  addDependency: (taskId: string, dependsOnId: string) => void;
  removeDependency: (taskId: string, dependsOnId: string) => void;
  commentsForTask: (taskId: string) => Comment[];
  addComment: (taskId: string, body: string) => void;
  removeComment: (id: string) => void;
  attachmentsForTask: (taskId: string) => Attachment[];
  addAttachment: (taskId: string, file: File) => Promise<void>;
  removeAttachment: (id: string) => void;
  addUpdate: (rawText: string, source?: UpdateSource) => void;
  removeUpdate: (id: string) => void;

  todayPlanTaskIds: (userId?: string) => string[];
  addToDayPlan: (taskId: string, userId?: string) => void;
  removeFromDayPlan: (taskId: string, userId?: string) => void;

  timeLogsFor: (userId: string, date: string) => TimeLog[];
  addTimeLog: (input: TimeLogInput) => string | null;
  updateTimeLog: (id: string, patch: Partial<TimeLogInput>) => void;
  removeTimeLog: (id: string) => void;

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
  setCurrentUserByEmail: (email: string) => void;
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
  comments: "comments",
  attachments: "attachments",
  day_selections: "daySelections",
  time_logs: "timeLogs",
};

export const useStore = create<State>((set, get) => ({
  tasks: tasksData as unknown as Task[],
  members: membersData as unknown as TeamMember[],
  projects: projectsData as unknown as Project[],
  clients: clientsData as unknown as Client[],
  dependencies: depsData as unknown as TaskDependency[],
  updates: updatesData as unknown as Update[],
  activity: activityData as unknown as ActivityEntry[],
  comments: commentsData as unknown as Comment[],
  attachments: attachmentsData as unknown as Attachment[],
  daySelections: daySelectionsData as unknown as DaySelection[],
  timeLogs: timeLogsData as unknown as TimeLog[],
  settings: settingsData as unknown as AppSettings,
  // With a backend configured, hold the shell (skeleton) until the first
  // hydrate lands so we never flash bundled data; otherwise render immediately.
  loaded: !supabase,

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
  commentsForTask: (taskId) =>
    get()
      .comments.filter((c) => c.task_id === taskId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at)),
  attachmentsForTask: (taskId) =>
    get()
      .attachments.filter((a) => a.task_id === taskId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at)),

  hydrate: async () => {
    if (get().loaded) return;
    if (!supabase) {
      // No backend configured — the bundled data is all there is; show it now.
      set({ loaded: true });
      return;
    }
    try {
      const [m, c, p, t, d, u, a, cm, at, ds, tl, s] = await Promise.all([
        supabase.from("team_members").select("*"),
        supabase.from("clients").select("*"),
        supabase.from("projects").select("*"),
        supabase.from("tasks").select("*"),
        supabase.from("task_dependencies").select("*"),
        supabase.from("updates").select("*"),
        supabase.from("activity_log").select("*"),
        supabase.from("comments").select("*"),
        supabase.from("attachments").select("*"),
        supabase.from("day_selections").select("*"),
        supabase.from("time_logs").select("*"),
        supabase.from("app_settings").select("*").eq("id", 1).single(),
      ]);
      const firstErr =
        m.error || c.error || p.error || t.error || d.error || u.error ||
        a.error || cm.error || at.error || ds.error || tl.error;
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
        comments: (cm.data as Comment[]) ?? get().comments,
        attachments: (at.data as Attachment[]) ?? get().attachments,
        daySelections: (ds.data as DaySelection[]) ?? get().daySelections,
        timeLogs: (tl.data as TimeLog[]) ?? get().timeLogs,
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
      "day_selections",
      "time_logs",
      "activity_log",
      "comments",
      "attachments",
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

  reorderColumn: (status, orderedIds) => {
    set((state) => ({
      tasks: state.tasks.map((t) => {
        const i = orderedIds.indexOf(t.id);
        return i >= 0 ? { ...t, order: i } : t;
      }),
    }));
    const changed = get().tasks.filter((t) => orderedIds.includes(t.id));
    if (changed.length) upsertRows("tasks", changed);
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

  deleteTask: (id) => {
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== id),
      dependencies: state.dependencies.filter(
        (d) => d.task_id !== id && d.depends_on_task_id !== id
      ),
      activity: state.activity.filter((a) => a.task_id !== id),
      daySelections: state.daySelections.filter((d) => d.task_id !== id),
      selectedTaskIds: state.selectedTaskIds.filter((x) => x !== id),
      detailTaskId: state.detailTaskId === id ? null : state.detailTaskId,
    }));
    deleteRow("tasks", { id }); // DB cascades deps + activity + day_selections
  },

  bulkDelete: (ids) => {
    const idSet = new Set(ids);
    set((state) => ({
      tasks: state.tasks.filter((t) => !idSet.has(t.id)),
      dependencies: state.dependencies.filter(
        (d) => !idSet.has(d.task_id) && !idSet.has(d.depends_on_task_id)
      ),
      activity: state.activity.filter((a) => !idSet.has(a.task_id)),
      daySelections: state.daySelections.filter((d) => !idSet.has(d.task_id)),
      selectedTaskIds: [],
      detailTaskId:
        state.detailTaskId && idSet.has(state.detailTaskId)
          ? null
          : state.detailTaskId,
    }));
    ids.forEach((id) => deleteRow("tasks", { id }));
  },

  addDependency: (taskId, dependsOnId) => {
    if (taskId === dependsOnId) return;
    const state = get();
    const exists = state.dependencies.some(
      (d) => d.task_id === taskId && d.depends_on_task_id === dependsOnId
    );
    // Avoid the trivial 2-cycle (A↔B).
    const reverse = state.dependencies.some(
      (d) => d.task_id === dependsOnId && d.depends_on_task_id === taskId
    );
    if (exists || reverse) return;
    const dep: TaskDependency = {
      task_id: taskId,
      depends_on_task_id: dependsOnId,
      type: "finish_start",
    };
    set({ dependencies: [...state.dependencies, dep] });
    upsertRows("task_dependencies", [dep]);
  },

  removeDependency: (taskId, dependsOnId) => {
    set((state) => ({
      dependencies: state.dependencies.filter(
        (d) => !(d.task_id === taskId && d.depends_on_task_id === dependsOnId)
      ),
    }));
    deleteRow("task_dependencies", {
      task_id: taskId,
      depends_on_task_id: dependsOnId,
    });
  },

  addComment: (taskId, body) => {
    const text = body.trim();
    if (!text) return;
    const comment: Comment = {
      id: genId("cm"),
      task_id: taskId,
      author_id: get().currentUserId,
      body: text,
      created_at: nowISO(),
    };
    set((state) => ({ comments: [...state.comments, comment] }));
    upsertRows("comments", [comment]);
  },

  removeComment: (id) => {
    set((state) => ({
      comments: state.comments.filter((c) => c.id !== id),
    }));
    deleteRow("comments", { id });
  },

  addAttachment: async (taskId, file) => {
    if (!supabase) return;
    const path = `${taskId}/${genId("f")}_${file.name}`;
    const { error } = await supabase.storage
      .from("attachments")
      .upload(path, file, { upsert: false });
    if (error) {
      console.error("[attachment] upload:", error.message);
      return;
    }
    const { data: pub } = supabase.storage
      .from("attachments")
      .getPublicUrl(path);
    const attachment: Attachment = {
      id: genId("at"),
      task_id: taskId,
      author_id: get().currentUserId,
      file_name: file.name,
      file_path: path,
      file_url: pub.publicUrl,
      size: file.size,
      created_at: nowISO(),
    };
    set((state) => ({ attachments: [...state.attachments, attachment] }));
    upsertRows("attachments", [attachment]);
  },

  removeAttachment: (id) => {
    const att = get().attachments.find((a) => a.id === id);
    set((state) => ({
      attachments: state.attachments.filter((a) => a.id !== id),
    }));
    deleteRow("attachments", { id });
    if (att && supabase) {
      void supabase.storage.from("attachments").remove([att.file_path]);
    }
  },

  addUpdate: (rawText, source = "ui") => {
    const text = rawText.trim();
    if (!text) return;
    const update: Update = {
      id: genId("up"),
      author_id: get().currentUserId,
      source,
      raw_text: text,
      parsed: "",
      task_id: null,
      created_at: nowISO(),
    };
    set((state) => ({ updates: [update, ...state.updates] }));
    upsertRows("updates", [update]);
  },

  removeUpdate: (id) => {
    set((state) => ({ updates: state.updates.filter((u) => u.id !== id) }));
    deleteRow("updates", { id });
  },

  todayPlanTaskIds: (userId) => {
    const state = get();
    const uid = userId ?? state.currentUserId;
    const date = toISODate(TODAY);
    return state.daySelections
      .filter((d) => d.user_id === uid && d.date === date)
      .map((d) => d.task_id);
  },

  addToDayPlan: (taskId, userId) => {
    const state = get();
    const uid = userId ?? state.currentUserId;
    const date = toISODate(TODAY);
    const id = `ds_${uid}_${date}_${taskId}`;
    if (state.daySelections.some((d) => d.id === id)) return;
    const row: DaySelection = {
      id,
      user_id: uid,
      date,
      task_id: taskId,
      created_at: nowISO(),
    };
    set({ daySelections: [...state.daySelections, row] });
    upsertRows("day_selections", [row]);
  },

  removeFromDayPlan: (taskId, userId) => {
    const state = get();
    const uid = userId ?? state.currentUserId;
    const date = toISODate(TODAY);
    const id = `ds_${uid}_${date}_${taskId}`;
    set({
      daySelections: state.daySelections.filter((d) => d.id !== id),
    });
    deleteRow("day_selections", { id });
  },

  timeLogsFor: (userId, date) =>
    get()
      .timeLogs.filter((l) => l.user_id === userId && l.date === date)
      .sort((a, b) => a.start_time.localeCompare(b.start_time)),

  addTimeLog: (input) => {
    const state = get();
    const minutes = minutesBetween(input.start_time, input.end_time);
    if (minutes === null) return null; // caller validates; belt and braces
    const row: TimeLog = {
      id: genId("tl"),
      user_id: input.user_id ?? state.currentUserId,
      project_id: input.project_id,
      task_id: input.task_id,
      date: input.date,
      start_time: input.start_time,
      end_time: input.end_time,
      minutes,
      note: input.note ?? "",
      created_at: nowISO(),
    };
    set({ timeLogs: [row, ...state.timeLogs] });
    upsertRows("time_logs", [row]);
    return row.id;
  },

  updateTimeLog: (id, patch) => {
    const existing = get().timeLogs.find((l) => l.id === id);
    if (!existing) return;
    const next: TimeLog = {
      ...existing,
      ...patch,
      note: patch.note ?? existing.note,
    };
    next.minutes = minutesBetween(next.start_time, next.end_time) ?? existing.minutes;
    set((state) => ({
      timeLogs: state.timeLogs.map((l) => (l.id === id ? next : l)),
    }));
    upsertRows("time_logs", [next]);
  },

  removeTimeLog: (id) => {
    set((state) => ({ timeLogs: state.timeLogs.filter((l) => l.id !== id) }));
    deleteRow("time_logs", { id });
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
    // Newest first — appended, it lands off-screen below the existing list.
    set({ projects: [project, ...state.projects] });
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
  setCurrentUserByEmail: (email) =>
    set((state) => {
      const m = state.members.find(
        (x) => x.email.toLowerCase() === email.toLowerCase()
      );
      return m ? { currentUserId: m.id } : {};
    }),
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
