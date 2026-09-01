import { useEffect, useRef, useState } from "react";
import { ListChecks, LogOut, Timer } from "lucide-react";
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

function Header({
  screen,
  setScreen,
}: {
  screen: Screen;
  setScreen: (s: Screen) => void;
}) {
  const me = useStore((s) => s.me);
  const signOut = useStore((s) => s.signOut);
  const [open, setOpen] = useState(false);
  const [auto, setAuto] = useState<boolean | null>(null);
  const [mini, setMini] = useState<boolean | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    if (auto === null)
      window.api?.getAutoLaunch?.().then(setAuto).catch(() => setAuto(false));
    if (mini === null)
      window.api?.getMiniEnabled?.().then(setMini).catch(() => setMini(true));
  }, [open, auto, mini]);

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
          <button className="menu-row" onClick={toggleAuto}>
            <span>Start on login</span>
            <span className="faint">
              {auto === null ? "…" : auto ? "On" : "Off"}
            </span>
          </button>
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
          startedAt: timer.startedAt,
        });
      } else {
        window.api.setTimerState({ mode: "idle", label: "Idle" });
      }
    };
    push();
    const id = setInterval(push, 1000);
    return () => clearInterval(id);
  }, [timer, brk, phase, taskById]);

  // Commands from the tray / mini window / idle prompt.
  useEffect(() => {
    if (!window.api?.onCommand) return;
    return window.api.onCommand((cmd) => {
      const s = useStore.getState();
      if (cmd === "stop") s.stopTimer();
      else if (cmd === "open-entries") setScreen("entries");
      else if (cmd === "open-picker") setScreen("main");
    });
  }, []);

  let body: React.ReactNode;
  if (phase === "init") body = <Loading label="Starting…" />;
  else if (phase === "loading") body = <Loading label="Loading your tasks…" />;
  else if (phase === "signed-out" || (phase === "authenticating" && !me)) {
    body = <LoginView />;
  } else if (phase === "authenticating") body = <Loading label="Signing in…" />;
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
