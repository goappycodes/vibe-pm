export {};

export interface TimerState {
  mode: "timer" | "break" | "idle" | "inactive" | "off";
  label: string;
  taskTitle?: string;
  taskId?: string;
  breakType?: string;
  startedAt?: number;
}

export interface ActivitySample {
  date: string;
  minute: string;
  activeSeconds: number;
  taskId: string | null;
  onBreak: boolean;
}

export interface IdleSettings {
  autoStop: boolean;
  minutes: number;
}

declare global {
  interface Window {
    api: {
      startAuth: () => Promise<{
        access_token: string;
        refresh_token: string;
        expires_at?: number;
      }>;
      getAutoLaunch: () => Promise<boolean>;
      setAutoLaunch: (enabled: boolean) => Promise<boolean>;
      hideWindow: () => void;
      setTimerState: (state: TimerState) => void;
      onCommand: (cb: (cmd: string, payload?: unknown) => void) => () => void;
      onTimerState: (cb: (s: TimerState) => void) => () => void;
      miniReady: () => void;
      miniCommand: (cmd: "open" | "stop") => void;
      getMiniEnabled: () => Promise<boolean>;
      setMiniEnabled: (enabled: boolean) => Promise<boolean>;
      getIdleSettings: () => Promise<IdleSettings>;
      setIdleSettings: (v: Partial<IdleSettings>) => Promise<IdleSettings>;
      onActivitySample: (cb: (s: ActivitySample) => void) => () => void;
    };
  }
}
