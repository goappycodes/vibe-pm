import {
  app,
  BrowserWindow,
  ipcMain,
  Notification,
  powerMonitor,
  shell,
} from "electron";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import electronUpdater from "electron-updater";
import { startActivityTracking, stopActivityTracking } from "./activity";
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

const IDLE_PROMPT_MS = 60 * 1000;

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
  const shouldShow =
    settings.miniEnabled &&
    lastState.mode !== "inactive" &&
    lastState.mode !== "off";
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

// --- prompt every minute while idle (no task, no break) ---
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

/** Shake the window horizontally to grab attention. */
function jitterWindow(win: BrowserWindow): void {
  if (win.isDestroyed()) return;
  const [baseX, baseY] = win.getPosition();
  const offsets = [18, -18, 15, -15, 12, -12, 9, -9, 6, -6, 3, -3, 0];
  let i = 0;
  const step = () => {
    if (win.isDestroyed()) return;
    win.setPosition(baseX + offsets[i], baseY);
    if (++i < offsets.length) setTimeout(step, 40);
    else win.setPosition(baseX, baseY);
  };
  step();
}

function promptPickTask(): void {
  if (!mainWindow || mainWindow.isDestroyed()) createWindow();
  const win = mainWindow;
  if (!win) return;
  // Force it to the front, above other windows, without permanently pinning it.
  if (win.isMinimized()) win.restore();
  win.show();
  win.setAlwaysOnTop(true);
  win.focus();
  win.moveTop();
  win.webContents.send("command", "open-picker");
  jitterWindow(win);
  setTimeout(() => {
    if (win && !win.isDestroyed()) win.setAlwaysOnTop(false);
  }, 2500);
  if (Notification.isSupported()) {
    new Notification({
      title: "Vibe Timer — you're idle",
      body: "Pick a task or start a break to keep tracking.",
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
      reconcileIdlePrompt();
      sendToMini(state);
      reconcileMini();
    });

    // Track OS input activity and let the (authed) main window persist each sample.
    startActivityTracking(
      () => ({ mode: lastState.mode, taskId: lastState.taskId ?? null }),
      (sample) => mainWindow?.webContents.send("activity:sample", sample)
    );

    // Sleep / lock: close the running timer or break so away time isn't counted.
    const onAway = (reason: string) => {
      if (lastState.mode !== "timer" && lastState.mode !== "break") return;
      const kind = lastState.mode === "break" ? "break" : "timer";
      mainWindow?.webContents.send("command", "suspend");
      if (Notification.isSupported()) {
        new Notification({
          title: "Vibe Timer stopped",
          body: `Your ${kind} was logged and stopped because the computer ${reason}.`,
        }).show();
      }
    };
    powerMonitor.on("suspend", () => onAway("went to sleep"));
    powerMonitor.on("lock-screen", () => onAway("was locked"));

    // Auto-update — packaged builds only; checks the configured GitHub releases.
    if (app.isPackaged) {
      electronUpdater.autoUpdater
        .checkForUpdatesAndNotify()
        .catch((e) => console.error("[updater]", e));
    }

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
    stopActivityTracking();
    destroyMini();
    destroyTray();
  });
}
