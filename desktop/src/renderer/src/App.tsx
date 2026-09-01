import { useEffect, useRef, useState } from "react";
import { LogOut, Timer } from "lucide-react";
import { useStore } from "./lib/store";
import { fmtElapsed } from "./lib/time";
import { BREAK_LABEL } from "./lib/types";
import { LoginView } from "./components/LoginView";
import { TaskPicker } from "./components/TaskPicker";
import { TimerView } from "./components/TimerView";
import { BreakView } from "./components/BreakView";

function Loading({ label }: { label: string }) {
  return (
    <div className="screen center">
      <div className="spinner" />
      <p className="faint small">{label}</p>
    </div>
  );
}

function Header() {
  const me = useStore((s) => s.me);
  const signOut = useStore((s) => s.signOut);
  const [open, setOpen] = useState(false);
  const [auto, setAuto] = useState<boolean | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && auto === null && window.api?.getAutoLaunch) {
      window.api
        .getAutoLaunch()
        .then(setAuto)
        .catch(() => setAuto(false));
    }
  }, [open, auto]);

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
    const applied = await window.api.setAutoLaunch(!(auto ?? false));
    setAuto(applied);
  };

  return (
    <div className="header" ref={ref}>
      <div className="brand">
        <span className="dot">
          <Timer style={{ width: 14, height: 14 }} />
        </span>
        Vibe Timer
      </div>
      <button
        className="avatar"
        onClick={() => setOpen((v) => !v)}
        title={me?.name}
      >
        {initial}
      </button>
      {open && (
        <div className="menu">
          <div className="who">
            <div className="name">{me?.name}</div>
            <div className="email">{me?.email}</div>
          </div>
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

  useEffect(() => {
    init();
  }, [init]);

  // Mirror live state into the tray tooltip/title, ticking every second.
  useEffect(() => {
    const push = () => {
      if (!window.api?.updateStatus) return;
      if (brk) {
        const sec = Math.floor((Date.now() - brk.startedAt) / 1000);
        window.api.updateStatus(`☕ ${BREAK_LABEL[brk.type]} · ${fmtElapsed(sec)}`);
      } else if (timer) {
        const sec = Math.floor((Date.now() - timer.startedAt) / 1000);
        const t = taskById(timer.taskId);
        window.api.updateStatus(`▶ ${fmtElapsed(sec)} · ${t?.title ?? "Task"}`);
      } else {
        window.api.updateStatus("Idle");
      }
    };
    push();
    const id = setInterval(push, 1000);
    return () => clearInterval(id);
  }, [timer, brk, taskById]);

  let body: React.ReactNode;
  if (phase === "init") body = <Loading label="Starting…" />;
  else if (phase === "loading") body = <Loading label="Loading your tasks…" />;
  else if (phase === "signed-out" || (phase === "authenticating" && !me)) {
    body = <LoginView />;
  } else if (phase === "authenticating") body = <Loading label="Signing in…" />;
  else if (brk) body = <BreakView />;
  else if (timer) body = <TimerView />;
  else body = <TaskPicker />;

  return (
    <div className="app">
      {phase === "ready" && <Header />}
      {body}
    </div>
  );
}
