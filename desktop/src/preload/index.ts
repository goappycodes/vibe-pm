import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
}

export interface TimerState {
  mode: "timer" | "break" | "idle" | "inactive";
  label: string; // preformatted text for the tray/mini, e.g. "▶ 12:34 · Design"
  taskTitle?: string;
  taskId?: string; // for activity attribution
  breakType?: string;
  startedAt?: number; // epoch ms, so the mini can tick its own clock
}

export interface ActivitySample {
  date: string; // real local YYYY-MM-DD
  minute: string; // real local HH:MM
  activeSeconds: number; // 0..60 of computer input activity in this minute
  taskId: string | null;
  onBreak: boolean;
}

const api = {
  // --- auth / window ---
  startAuth: (): Promise<AuthTokens> => ipcRenderer.invoke("auth:start"),
  getAutoLaunch: (): Promise<boolean> => ipcRenderer.invoke("autolaunch:get"),
  setAutoLaunch: (enabled: boolean): Promise<boolean> =>
    ipcRenderer.invoke("autolaunch:set", enabled),
  hideWindow: (): void => ipcRenderer.send("window:hide"),

  // --- main window -> main process: live timer/break state ---
  setTimerState: (state: TimerState): void =>
    ipcRenderer.send("timer:state", state),

  // --- main process -> main window: commands (from tray / mini / idle prompt) ---
  onCommand: (cb: (cmd: string) => void): (() => void) => {
    const h = (_e: IpcRendererEvent, cmd: string) => cb(cmd);
    ipcRenderer.on("command", h);
    return () => ipcRenderer.removeListener("command", h);
  },

  // --- mini window ---
  onTimerState: (cb: (s: TimerState) => void): (() => void) => {
    const h = (_e: IpcRendererEvent, s: TimerState) => cb(s);
    ipcRenderer.on("timer:state", h);
    return () => ipcRenderer.removeListener("timer:state", h);
  },
  miniReady: (): void => ipcRenderer.send("mini:ready"),
  miniCommand: (cmd: "open" | "stop"): void =>
    ipcRenderer.send("mini:command", cmd),

  // --- mini enable toggle (persisted) ---
  getMiniEnabled: (): Promise<boolean> => ipcRenderer.invoke("mini:get"),
  setMiniEnabled: (enabled: boolean): Promise<boolean> =>
    ipcRenderer.invoke("mini:set", enabled),

  // --- activity tracking: main samples input, main window persists it ---
  onActivitySample: (cb: (s: ActivitySample) => void): (() => void) => {
    const h = (_e: IpcRendererEvent, s: ActivitySample) => cb(s);
    ipcRenderer.on("activity:sample", h);
    return () => ipcRenderer.removeListener("activity:sample", h);
  },
};

contextBridge.exposeInMainWorld("api", api);

export type Api = typeof api;
