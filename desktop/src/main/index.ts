import { app, BrowserWindow, ipcMain, shell } from "electron";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { startBrowserLogin } from "./auth";
import { isAutoLaunchEnabled, setAutoLaunch } from "./autolaunch";
import { createTray, destroyTray, updateTrayStatus } from "./tray";

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;

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

  // Closing the window hides it to the tray; only an explicit Quit exits.
  mainWindow.on("close", (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // External links (e.g. "manage tasks in the web app") open in the browser.
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
}

// On first packaged run, opt the user into launch-at-login so the timer "auto
// starts" as designed. They can turn it off in the app afterwards (persisted by
// the OS login item / autostart file, so we don't force it every launch).
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
    ipcMain.on("status:update", (_e, status: string) =>
      updateTrayStatus(String(status || "Idle"))
    );
    ipcMain.on("window:hide", () => mainWindow?.hide());

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
      showWindow();
    });
  });

  // Keep running in the tray after the window is closed (all platforms).
  app.on("window-all-closed", () => {
    /* no-op: the tray keeps the app alive */
  });

  app.on("before-quit", () => {
    isQuitting = true;
  });

  app.on("will-quit", () => destroyTray());
}
