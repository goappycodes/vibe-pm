import { useEffect, useRef, useState } from "react";
import { ListChecks, LogOut, Play, Power, Timer } from "lucide-react";
import { useStore } from "./lib/store";
import { fmtElapsed } from "./lib/time";
import { BREAK_LABEL } from "./lib/types";
import { LoginView } from "./components/LoginView";
import { TaskPicker } from "./components/TaskPicker";
import { TimerView } from "./components/TimerView";
import { BreakView } from "./components/BreakView";
import { EntriesView } from "./components/EntriesView";

type Screen = "main" | "entries";

function Loading({ label }: { label: string }) {
  return (
    <div className="screen center">
      <div className="spinner" />
      <p className="faint small">{label}</p>
    </div>
  );
}

function StoppedView({ onStart }: { onStart: () => void }) {
  return (
    <div className="screen center">
      <div
        className="dot"
        style={{
          width: 46,
          height: 46,
          background: "var(--surface-2)",
          color: "var(--faint)",
        }}
      >
        <Power style={{ width: 22, height: 22 }} />
      </div>
      <h1 style={{ marginTop: 10 }}>Done for the day</h1>
      <p className="muted small" style={{ maxWidth: 260 }}>
        Tracking is paused — no timer, breaks, or activity are recorded. Enjoy
        your personal time.
      </p>
      <button
        className="btn btn-primary btn-lg btn-block"
        style={{ maxWidth: 260, marginTop: 12 }}
        onClick={onStart}
      >
        <Play className="icon" fill="currentColor" /> Start work
      </button>
      <p className="faint small" style={{ maxWidth: 260, marginTop: 14 }}>
        The app stays in the tray. It won&apos;t nudge you or track anything until
        you start work again.
      </p>
    </div>
  );
}

function Header({
  screen,
  setScreen,
}: {
  screen: Screen;
  setScreen: (s: Screen) => void;
}) {
  const me = useStore((s) => s.me);
  const signOut = useStore((s) => s.signOut);
  const workStopped = useStore((s) => s.workStopped);
  const stopWork = useStore((s) => s.stopWork);
  const [open, setOpen] = useState(false);
  const [auto, setAuto] = useState<boolean | null>(null);
  const [mini, setMini] = useState<boolean | null>(null);
  const [idle, setIdle] = useState<{ autoStop: boolean; minutes: number } | null>(
    null
  );
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    if (auto === null)
      window.api?.getAutoLaunch?.().then(setAuto).catch(() => setAuto(false));
    if (mini === null)
      window.api?.getMiniEnabled?.().then(setMini).catch(() => setMini(true));
    if (idle === null)
      window.api
        ?.getIdleSettings?.()
        .then(setIdle)
        .catch(() => setIdle({ autoStop: true, minutes: 15 }));
  }, [open, auto, mini, idle]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const initial = me?.name?.trim()?.[0]?.toUpperCase() ?? "?";

  const toggleAuto = async () => {
    if (!window.api?.setAutoLaunch) return;
    setAuto(await window.api.setAutoLaunch(!(auto ?? false)));
  };
  const toggleMini = async () => {
    if (!window.api?.setMiniEnabled) return;
    setMini(await window.api.setMiniEnabled(!(mini ?? true)));
  };
  const toggleIdle = async () => {
    if (!window.api?.setIdleSettings) return;
    setIdle(
      await window.api.setIdleSettings({ autoStop: !(idle?.autoStop ?? true) })
    );
  };
  const cycleIdleMinutes = async () => {
    if (!window.api?.setIdleSettings) return;
    const presets = [10, 15, 20, 30];
    const cur = idle?.minutes ?? 15;
    const next = presets[(presets.indexOf(cur) + 1) % presets.length] ?? 15;
    setIdle(await window.api.setIdleSettings({ minutes: next }));
  };

  return (
    <div className="header" ref={ref}>
      <div className="brand">
        <span className="dot">
          <Timer style={{ width: 14, height: 14 }} />
        </span>
        Vibe Timer
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button
          className={`icon-btn ${screen === "entries" ? "active" : ""}`}
          title="My time entries"
          onClick={() => setScreen(screen === "entries" ? "main" : "entries")}
        >
          <ListChecks className="icon" />
        </button>
        <button
          className="avatar"
          onClick={() => setOpen((v) => !v)}
          title={me?.name}
        >
          {initial}
        </button>
      </div>
      {open && (
        <div className="menu">
          <div className="who">
            <div className="name">{me?.name}</div>
            <div className="email">{me?.email}</div>
          </div>
          <button className="menu-row" onClick={toggleMini}>
            <span>Mini timer overlay</span>
            <span className="faint">
              {mini === null ? "…" : mini ? "On" : "Off"}
            </span>
          </button>
          <button className="menu-row" onClick={toggleIdle}>
            <span>Auto-stop when idle</span>
            <span className="faint">
              {idle === null ? "…" : idle.autoStop ? "On" : "Off"}
            </span>
          </button>
          {idle?.autoStop && (
            <button className="menu-row" onClick={cycleIdleMinutes}>
              <span>Idle timeout</span>
              <span className="faint">{idle.minutes} min</span>
            </button>
          )}
          <button className="menu-row" onClick={toggleAuto}>
            <span>Start on login</span>
            <span className="faint">
              {auto === null ? "…" : auto ? "On" : "Off"}
            </span>
          </button>
          {!workStopped && (
            <button
              className="menu-row"
              onClick={() => {
                setOpen(false);
                stopWork();
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Power className="icon" /> Stop work for today
              </span>
            </button>
          )}
          <button
            className="menu-row"
            onClick={() => {
              setOpen(false);
              void signOut();
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <LogOut className="icon" /> Sign out
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

export function App() {
  const init = useStore((s) => s.init);
  const phase = useStore((s) => s.phase);
  const me = useStore((s) => s.me);
  const timer = useStore((s) => s.timer);
  const brk = useStore((s) => s.brk);
  const workStopped = useStore((s) => s.workStopped);
  const startWork = useStore((s) => s.startWork);
  const taskById = useStore((s) => s.taskById);
  const [screen, setScreen] = useState<Screen>("main");

  useEffect(() => {
    init();
  }, [init]);

  // Report live state to the main process (tray, mini window, idle prompt).
  useEffect(() => {
    const push = () => {
      if (!window.api?.setTimerState) return;
      if (phase !== "ready") {
        window.api.setTimerState({ mode: "inactive", label: "" });
        return;
      }
      if (workStopped) {
        window.api.setTimerState({ mode: "off", label: "Not working" });
        return;
      }
      if (brk) {
        const sec = Math.floor((Date.now() - brk.startedAt) / 1000);
        window.api.setTimerState({
          mode: "break",
          label: `☕ ${BREAK_LABEL[brk.type]} · ${fmtElapsed(sec)}`,
          breakType: BREAK_LABEL[brk.type],
          startedAt: brk.startedAt,
        });
      } else if (timer) {
        const sec = Math.floor((Date.now() - timer.startedAt) / 1000);
        const t = taskById(timer.taskId);
        window.api.setTimerState({
          mode: "timer",
          label: `▶ ${fmtElapsed(sec)} · ${t?.title ?? "Task"}`,
          taskTitle: t?.title ?? "Task",
          taskId: timer.taskId,
          startedAt: timer.startedAt,
        });
      } else {
        window.api.setTimerState({ mode: "idle", label: "Idle" });
      }
    };
    push();
    const id = setInterval(push, 1000);
    return () => clearInterval(id);
  }, [timer, brk, phase, taskById, workStopped]);

  // Commands from the tray / mini window / idle prompt.
  useEffect(() => {
    if (!window.api?.onCommand) return;
    return window.api.onCommand((cmd, payload) => {
      const s = useStore.getState();
      if (cmd === "stop") s.stopTimer();
      else if (cmd === "open-entries") setScreen("entries");
      else if (cmd === "open-picker") setScreen("main");
      else if (cmd === "suspend") {
        // Computer slept/locked — close the open segment so away time isn't counted.
        if (s.timer) s.stopTimer();
        else if (s.brk) s.endBreak();
      } else if (cmd === "idle-stop") {
        // Auto-stopped for inactivity — log only up to the last-active time.
        const lastActiveMs =
          typeof payload === "number" ? payload : Date.now();
        if (s.timer) s.stopTimer(lastActiveMs);
      }
    });
  }, []);

  // Persist OS activity samples the main process pushes (works while hidden too).
  useEffect(() => {
    if (!window.api?.onActivitySample) return;
    return window.api.onActivitySample((s) => {
      useStore.getState().recordActivity(s);
    });
  }, []);

  let body: React.ReactNode;
  if (phase === "init") body = <Loading label="Starting…" />;
  else if (phase === "loading") body = <Loading label="Loading your tasks…" />;
  else if (phase === "signed-out" || (phase === "authenticating" && !me)) {
    body = <LoginView />;
  } else if (phase === "authenticating") body = <Loading label="Signing in…" />;
  else if (workStopped) body = <StoppedView onStart={startWork} />;
  else if (screen === "entries")
    body = <EntriesView onBack={() => setScreen("main")} />;
  else if (brk) body = <BreakView />;
  else if (timer) body = <TimerView />;
  else body = <TaskPicker />;

  return (
    <div className="app">
      {phase === "ready" && <Header screen={screen} setScreen={setScreen} />}
      {body}
    </div>
  );
}
