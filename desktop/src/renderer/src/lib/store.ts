import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";
import { hasConfig, supabase } from "./supabase";
import {
  addMinutesToHHMM,
  genId,
  hhmm,
  minutesSince,
  todayISO,
} from "./time";
import type { BreakType, Project, Task, TeamMember } from "./types";

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
  tasks: Task[]; // my open tasks
  planTaskIds: string[]; // today's My Day plan
  projectsById: Record<string, Project>;

  timer: RunningTimer | null;
  brk: RunningBreak | null;

  init: () => void;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  reloadData: () => Promise<void>;

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
      supabase
        .from("tasks")
        .select("id,project_id,title,assignee_id,due_date,story_points,status,urgency")
        .eq("assignee_id", me.id)
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
    const minutes = minutesSince(timer.startedAt);
    const startClock = hhmm(new Date(timer.startedAt));
    set({ timer: null });
    save(TIMER_KEY, null);
    void supabase
      .from("time_logs")
      .insert({
        id: genId("tl"),
        user_id: me.id,
        project_id: task?.project_id ?? null,
        task_id: timer.taskId,
        date: todayISO(),
        start_time: startClock,
        end_time: addMinutesToHHMM(startClock, minutes),
        minutes,
        note: "Timer (desktop)",
      })
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
    const minutes = minutesSince(brk.startedAt);
    const startClock = hhmm(new Date(brk.startedAt));
    void supabase
      .from("breaks")
      .insert({
        id: genId("br"),
        user_id: me.id,
        date: todayISO(),
        start_time: startClock,
        end_time: addMinutesToHHMM(startClock, minutes),
        minutes,
        type: brk.type,
        note: "",
      })
      .then(({ error }) => {
        if (error) console.error("[breaks] insert:", error.message);
      });
  },
}));
