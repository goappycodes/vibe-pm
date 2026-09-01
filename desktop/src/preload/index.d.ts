export {};

export interface TimerState {
  mode: "timer" | "break" | "idle" | "inactive";
  label: string;
  taskTitle?: string;
  breakType?: string;
  startedAt?: number;
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
      onCommand: (cb: (cmd: string) => void) => () => void;
      onTimerState: (cb: (s: TimerState) => void) => () => void;
      miniReady: () => void;
      miniCommand: (cmd: "open" | "stop") => void;
      getMiniEnabled: () => Promise<boolean>;
      setMiniEnabled: (enabled: boolean) => Promise<boolean>;
    };
  }
}
