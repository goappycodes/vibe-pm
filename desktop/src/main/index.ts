import { app, BrowserWindow, ipcMain, Notification, shell } from "electron";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { startBrowserLogin } from "./auth";
import { isAutoLaunchEnabled, setAutoLaunch } from "./autolaunch";
import { createTray, destroyTray, updateTrayStatus } from "./tray";
import { loadSettings, saveSettings, type Settings } from "./settings";
import {
  createMini,
  destroyMini,
  getMini,
  hideMini,
  sendToMini,
  showMini,
} from "./mini";
import type { TimerState } from "../preload/index";

const IDLE_PROMPT_MS = 5 * 60 * 1000;

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;
let settings: Settings;
let lastState: TimerState = { mode: "inactive", label: "" };
let idleTimer: NodeJS.Timeout | null = null;

function resourcesDir(): string {
  return app.isPackaged
    ? process.resourcesPath
    : join(__dirname, "../../resources");
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 640,
    minWidth: 360,
    minHeight: 540,
    show: false,
    resizable: true,
    maximizable: false,
    fullscreenable: false,
    title: "Vibe Timer",
    icon: join(resourcesDir(), "icon.png"),
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow?.show();
    mainWindow?.focus();
  });

  mainWindow.on("close", (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  const devUrl = process.env["ELECTRON_RENDERER_URL"];
  if (devUrl) {
    void mainWindow.loadURL(devUrl);
  } else {
    void mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

function showWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) createWindow();
  mainWindow?.show();
  mainWindow?.focus();
  if (process.platform === "win32") mainWindow?.flashFrame(false);
}

function sendCommand(cmd: string): void {
  mainWindow?.webContents.send("command", cmd);
}

// --- mini window visibility follows auth + the mini toggle ---
function reconcileMini(): void {
  const shouldShow = settings.miniEnabled && lastState.mode !== "inactive";
  if (shouldShow) {
    if (!getMini()) {
      createMini(settings, (bounds) => {
        settings.miniBounds = bounds;
        saveSettings(settings);
      });
    }
    showMini();
    sendToMini(lastState);
  } else {
    hideMini();
  }
}

// --- prompt every 5 minutes while idle (no task, no break) ---
function reconcileIdlePrompt(): void {
  if (lastState.mode === "idle") {
    if (!idleTimer) {
      idleTimer = setInterval(() => {
        if (lastState.mode === "idle") promptPickTask();
      }, IDLE_PROMPT_MS);
    }
  } else if (idleTimer) {
    clearInterval(idleTimer);
    idleTimer = null;
  }
}

function promptPickTask(): void {
  showWindow();
  mainWindow?.webContents.send("command", "open-picker");
  if (process.platform === "win32") mainWindow?.flashFrame(true);
  if (Notification.isSupported()) {
    new Notification({
      title: "Vibe Timer",
      body: "You're not tracking anything — pick a task or start a break.",
    }).show();
  }
}

function ensureFirstRunAutoLaunch(): void {
  if (!app.isPackaged) return;
  const marker = join(app.getPath("userData"), ".first-run-done");
  if (existsSync(marker)) return;
  try {
    setAutoLaunch(true);
    writeFileSync(marker, new Date().toISOString());
  } catch (e) {
    console.error("[autolaunch] first-run enable failed:", e);
  }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => showWindow());

  app.whenReady().then(() => {
    app.setAppUserModelId("com.appycodes.vibetimer"); // Windows notifications/tray
    settings = loadSettings();
    ensureFirstRunAutoLaunch();
    createWindow();
    createTray({
      onOpen: () => showWindow(),
      onQuit: () => {
        isQuitting = true;
        app.quit();
      },
    });

    ipcMain.handle("auth:start", () => startBrowserLogin());
    ipcMain.handle("autolaunch:get", () => isAutoLaunchEnabled());
    ipcMain.handle("autolaunch:set", (_e, enabled: boolean) => {
      setAutoLaunch(!!enabled);
      return isAutoLaunchEnabled();
    });
    ipcMain.on("window:hide", () => mainWindow?.hide());

    // Live state from the main window drives the tray, mini window, and idle prompt.
    ipcMain.on("timer:state", (_e, state: TimerState) => {
      lastState = state;
      updateTrayStatus(state.label || "Idle");
      sendToMini(state);
      reconcileMini();
      reconcileIdlePrompt();
    });

    // Mini window controls.
    ipcMain.on("mini:ready", () => sendToMini(lastState));
    ipcMain.on("mini:command", (_e, cmd: "open" | "stop") => {
      if (cmd === "open") showWindow();
      else if (cmd === "stop") sendCommand("stop");
    });
    ipcMain.handle("mini:get", () => settings.miniEnabled);
    ipcMain.handle("mini:set", (_e, enabled: boolean) => {
      settings.miniEnabled = !!enabled;
      saveSettings(settings);
      reconcileMini();
      return settings.miniEnabled;
    });

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
      showWindow();
    });
  });

  app.on("window-all-closed", () => {
    /* stay alive in the tray */
  });

  app.on("before-quit", () => {
    isQuitting = true;
  });

  app.on("will-quit", () => {
    if (idleTimer) clearInterval(idleTimer);
    destroyMini();
    destroyTray();
  });
}
