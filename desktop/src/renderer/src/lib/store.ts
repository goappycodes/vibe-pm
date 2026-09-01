import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";
import { hasConfig, supabase } from "./supabase";
import {
  addMinutesToHHMM,
  genId,
  hhmm,
  isFrozenDate,
  minutesSince,
  splitInterval,
  todayISO,
} from "./time";
import { BREAK_LABEL, type BreakType, type Project, type Task, type TeamMember, type TimeEntry } from "./types";

export interface RunningTimer {
  taskId: string;
  startedAt: number; // epoch ms
}
export interface RunningBreak {
  type: BreakType;
  startedAt: number; // epoch ms
}

const TIMER_KEY = "vibe-timer.running";
const BREAK_KEY = "vibe-timer.break";

function load<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function save(key: string, val: unknown) {
  try {
    if (val) localStorage.setItem(key, JSON.stringify(val));
    else localStorage.removeItem(key);
  } catch {
    /* storage disabled */
  }
}

type AuthPhase = "init" | "signed-out" | "authenticating" | "loading" | "ready";

interface State {
  hasConfig: boolean;
  phase: AuthPhase;
  authError: string | null;

  me: TeamMember | null;
  tasks: Task[]; // all open tasks (picker filters to "mine" unless Show all)
  planTaskIds: string[]; // today's My Day plan
  projectsById: Record<string, Project>;

  entries: TimeEntry[]; // my time_logs + breaks (recent), for the Entries view
  entriesLoading: boolean;

  timer: RunningTimer | null;
  brk: RunningBreak | null;

  init: () => void;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  reloadData: () => Promise<void>;
  loadEntries: () => Promise<void>;
  addComment: (taskId: string, body: string) => Promise<boolean>;
  requestEntryChange: (
    type: "edit" | "add" | "delete",
    input: {
      timeLogId?: string;
      taskId?: string | null;
      projectId?: string | null;
      date?: string;
      start_time?: string;
      end_time?: string;
      note?: string;
      reason?: string;
    }
  ) => Promise<boolean>;
  recordActivity: (s: {
    date: string;
    minute: string;
    activeSeconds: number;
    taskId: string | null;
    onBreak: boolean;
  }) => void;

  taskById: (id: string | null | undefined) => Task | undefined;

  startTimer: (taskId: string) => void;
  stopTimer: () => void; // logs the worked segment
  discardTimer: () => void; // stops without logging
  switchTask: () => void; // logs current, returns to picker

  startBreak: (type: BreakType) => void; // logs current work, begins break
  endBreak: () => void; // logs the break, returns to picker
}

async function loadMemberByEmail(email: string): Promise<TeamMember | null> {
  const { data, error } = await supabase
    .from("team_members")
    .select("id,name,email,avatar,role,timezone")
    .ilike("email", email)
    .limit(1);
  if (error) {
    console.error("[member] lookup:", error.message);
    return null;
  }
  return (data?.[0] as TeamMember | undefined) ?? null;
}

export const useStore = create<State>((set, get) => ({
  hasConfig,
  phase: "init",
  authError: null,

  me: null,
  tasks: [],
  planTaskIds: [],
  projectsById: {},
  entries: [],
  entriesLoading: false,

  timer: load<RunningTimer>(TIMER_KEY),
  brk: load<RunningBreak>(BREAK_KEY),

  init: () => {
    if (!hasConfig) {
      set({ phase: "signed-out", authError: "Missing Supabase configuration." });
      return;
    }
    const onSession = async (session: Session | null) => {
      const email = session?.user?.email;
      if (!email) {
        set({ phase: "signed-out", me: null });
        return;
      }
      // Already resolved this user? Don't reload on every token refresh.
      if (get().me && get().me!.email.toLowerCase() === email.toLowerCase()) {
        return;
      }
      set({ phase: "loading", authError: null });
      const me = await loadMemberByEmail(email);
      if (!me) {
        set({
          phase: "signed-out",
          me: null,
          authError: `${email} isn't on the team yet. Ask an admin to add you.`,
        });
        await supabase.auth.signOut();
        return;
      }
      set({ me });
      await get().reloadData();
      set({ phase: "ready" });
    };

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) void onSession(data.session);
      else set({ phase: "signed-out" });
    });
    supabase.auth.onAuthStateChange((_event, session) => {
      void onSession(session);
    });
  },

  signIn: async () => {
    if (!window.api?.startAuth) {
      set({ authError: "Desktop bridge unavailable. Restart the app." });
      return;
    }
    set({ phase: "authenticating", authError: null });
    try {
      const tokens = await window.api.startAuth();
      const { error } = await supabase.auth.setSession({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
      });
      if (error) throw error;
      // onAuthStateChange picks it up and loads data.
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sign-in failed.";
      set({ phase: "signed-out", authError: msg });
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({
      phase: "signed-out",
      me: null,
      tasks: [],
      planTaskIds: [],
      projectsById: {},
    });
  },

  reloadData: async () => {
    const me = get().me;
    if (!me) return;
    const date = todayISO();
    const [tasksRes, projRes, planRes] = await Promise.all([
      // All open tasks — the picker shows "mine" by default and can toggle to all.
      supabase
        .from("tasks")
        .select("id,project_id,title,assignee_id,due_date,story_points,status,urgency")
        .neq("status", "done"),
      supabase.from("projects").select("id,name,color,status"),
      supabase
        .from("day_selections")
        .select("task_id")
        .eq("user_id", me.id)
        .eq("date", date),
    ]);
    if (tasksRes.error) console.error("[tasks]", tasksRes.error.message);
    if (projRes.error) console.error("[projects]", projRes.error.message);
    if (planRes.error) console.error("[plan]", planRes.error.message);

    const projectsById: Record<string, Project> = {};
    for (const p of (projRes.data as Project[] | null) ?? []) {
      projectsById[p.id] = p;
    }
    set({
      tasks: (tasksRes.data as Task[] | null) ?? [],
      projectsById,
      planTaskIds:
        (planRes.data as { task_id: string }[] | null)?.map((r) => r.task_id) ??
        [],
    });
  },

  loadEntries: async () => {
    const me = get().me;
    if (!me) return;
    set({ entriesLoading: true });
    const [logsRes, brkRes, reqRes] = await Promise.all([
      supabase
        .from("time_logs")
        .select(
          "id,date,start_time,end_time,minutes,note,task_id,project_id,modified,task:tasks(title)"
        )
        .eq("user_id", me.id)
        .order("date", { ascending: false })
        .order("start_time", { ascending: false })
        .limit(300),
      supabase
        .from("breaks")
        .select("id,date,start_time,end_time,minutes,type")
        .eq("user_id", me.id)
        .order("date", { ascending: false })
        .order("start_time", { ascending: false })
        .limit(300),
      supabase
        .from("time_log_change_requests")
        .select("time_log_id")
        .eq("user_id", me.id)
        .eq("status", "pending"),
    ]);
    if (logsRes.error) console.error("[entries/logs]", logsRes.error.message);
    if (brkRes.error) console.error("[entries/breaks]", brkRes.error.message);
    if (reqRes.error) console.error("[entries/requests]", reqRes.error.message);

    const pendingIds = new Set(
      ((reqRes.data as { time_log_id: string | null }[] | null) ?? [])
        .map((r) => r.time_log_id)
        .filter((x): x is string => !!x)
    );

    type LogRow = {
      id: string;
      date: string;
      start_time: string;
      end_time: string;
      minutes: number;
      note: string;
      task_id: string | null;
      project_id: string | null;
      modified: boolean;
      task: { title: string } | { title: string }[] | null;
    };
    type BrkRow = {
      id: string;
      date: string;
      start_time: string;
      end_time: string;
      minutes: number;
      type: BreakType;
    };
    const titleOf = (t: LogRow["task"]): string | null =>
      Array.isArray(t) ? t[0]?.title ?? null : t?.title ?? null;

    const work: TimeEntry[] = ((logsRes.data as LogRow[] | null) ?? []).map(
      (r) => ({
        id: r.id,
        kind: "work",
        date: r.date,
        start_time: r.start_time,
        end_time: r.end_time,
        minutes: r.minutes,
        title: titleOf(r.task) ?? (r.note || "Untitled task"),
        taskId: r.task_id,
        projectId: r.project_id,
        modified: r.modified,
        pending: pendingIds.has(r.id),
      })
    );
    const rest: TimeEntry[] = ((brkRes.data as BrkRow[] | null) ?? []).map(
      (r) => ({
        id: r.id,
        kind: "break",
        date: r.date,
        start_time: r.start_time,
        end_time: r.end_time,
        minutes: r.minutes,
        title: BREAK_LABEL[r.type] ?? "Break",
      })
    );
    const entries = [...work, ...rest].sort(
      (a, b) =>
        b.date.localeCompare(a.date) || b.start_time.localeCompare(a.start_time)
    );
    set({ entries, entriesLoading: false });
  },

  addComment: async (taskId, body) => {
    const me = get().me;
    const text = body.trim();
    if (!me || !text) return false;
    const { error } = await supabase.from("comments").insert({
      id: genId("cm"),
      task_id: taskId,
      author_id: me.id,
      body: text,
    });
    if (error) {
      console.error("[comments] insert:", error.message);
      return false;
    }
    return true;
  },

  requestEntryChange: async (type, input) => {
    const me = get().me;
    if (!me) return false;
    const payload =
      type === "delete"
        ? {}
        : {
            task_id: input.taskId ?? null,
            project_id: input.projectId ?? null,
            date: input.date,
            start_time: input.start_time,
            end_time: input.end_time,
            note: input.note ?? "",
          };
    const { error } = await supabase.from("time_log_change_requests").insert({
      id: genId("cr"),
      time_log_id: input.timeLogId ?? null,
      user_id: me.id,
      type,
      payload,
      status: "pending",
      note: input.reason ?? "",
    });
    if (error) {
      console.error("[change-request] insert:", error.message);
      return false;
    }
    await get().loadEntries();
    return true;
  },

  recordActivity: (s) => {
    const me = get().me;
    if (!me) return;
    // Deterministic id → upserts the same minute bucket in place.
    const id = `as_${me.id}_${s.date}_${s.minute}`;
    void supabase
      .from("activity_samples")
      .upsert({
        id,
        user_id: me.id,
        date: s.date,
        minute: s.minute,
        active_seconds: Math.round(s.activeSeconds),
        task_id: s.taskId,
        on_break: s.onBreak,
      })
      .then(({ error }) => {
        if (error) console.error("[activity] upsert:", error.message);
      });
  },

  taskById: (id) => get().tasks.find((t) => t.id === id),

  startTimer: (taskId) => {
    if (get().timer) get().stopTimer();
    const timer: RunningTimer = { taskId, startedAt: Date.now() };
    set({ timer, brk: null });
    save(TIMER_KEY, timer);
    save(BREAK_KEY, null);
  },

  stopTimer: () => {
    const { timer, me } = get();
    if (!timer || !me) {
      set({ timer: null });
      save(TIMER_KEY, null);
      return;
    }
    const task = get().taskById(timer.taskId);
    set({ timer: null });
    save(TIMER_KEY, null);
    // Frozen-date demo mode logs a single entry; real mode splits across midnight.
    const segments = isFrozenDate()
      ? [
          {
            date: todayISO(),
            start_time: hhmm(new Date(timer.startedAt)),
            end_time: addMinutesToHHMM(
              hhmm(new Date(timer.startedAt)),
              minutesSince(timer.startedAt)
            ),
            minutes: minutesSince(timer.startedAt),
          },
        ]
      : splitInterval(timer.startedAt, Date.now());
    const rows = segments.map((s) => ({
      id: genId("tl"),
      user_id: me.id,
      project_id: task?.project_id ?? null,
      task_id: timer.taskId,
      date: s.date,
      start_time: s.start_time,
      end_time: s.end_time,
      minutes: s.minutes,
      note: "Timer (desktop)",
    }));
    void supabase
      .from("time_logs")
      .insert(rows)
      .then(({ error }) => {
        if (error) console.error("[time_logs] insert:", error.message);
      });
  },

  discardTimer: () => {
    set({ timer: null });
    save(TIMER_KEY, null);
  },

  switchTask: () => {
    get().stopTimer();
  },

  startBreak: (type) => {
    if (get().timer) get().stopTimer(); // log the work done so far
    const brk: RunningBreak = { type, startedAt: Date.now() };
    set({ brk, timer: null });
    save(BREAK_KEY, brk);
    save(TIMER_KEY, null);
  },

  endBreak: () => {
    const { brk, me } = get();
    set({ brk: null });
    save(BREAK_KEY, null);
    if (!brk || !me) return;
    const segments = isFrozenDate()
      ? [
          {
            date: todayISO(),
            start_time: hhmm(new Date(brk.startedAt)),
            end_time: addMinutesToHHMM(
              hhmm(new Date(brk.startedAt)),
              minutesSince(brk.startedAt)
            ),
            minutes: minutesSince(brk.startedAt),
          },
        ]
      : splitInterval(brk.startedAt, Date.now());
    const rows = segments.map((s) => ({
      id: genId("br"),
      user_id: me.id,
      date: s.date,
      start_time: s.start_time,
      end_time: s.end_time,
      minutes: s.minutes,
      type: brk.type,
      note: "",
    }));
    void supabase
      .from("breaks")
      .insert(rows)
      .then(({ error }) => {
        if (error) console.error("[breaks] insert:", error.message);
      });
  },
}));
