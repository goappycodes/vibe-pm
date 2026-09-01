import { contextBridge, ipcRenderer } from "electron";

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
}

const api = {
  /** Kick off browser sign-in; resolves with the Supabase session tokens. */
  startAuth: (): Promise<AuthTokens> => ipcRenderer.invoke("auth:start"),
  getAutoLaunch: (): Promise<boolean> => ipcRenderer.invoke("autolaunch:get"),
  setAutoLaunch: (enabled: boolean): Promise<boolean> =>
    ipcRenderer.invoke("autolaunch:set", enabled),
  /** Push a short status string to the tray tooltip/title. */
  updateStatus: (status: string): void =>
    ipcRenderer.send("status:update", status),
  hideWindow: (): void => ipcRenderer.send("window:hide"),
};

contextBridge.exposeInMainWorld("api", api);

export type Api = typeof api;
