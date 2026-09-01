import { BrowserWindow, screen, type Rectangle } from "electron";
import { join } from "node:path";
import type { Settings } from "./settings";
import type { TimerState } from "../preload/index";

const WIDTH = 240;
const HEIGHT = 60;

let mini: BrowserWindow | null = null;

export function getMini(): BrowserWindow | null {
  return mini && !mini.isDestroyed() ? mini : null;
}

/** Create the always-on-top mini timer window (hidden until shown). */
export function createMini(
  settings: Settings,
  onMoved: (b: Rectangle) => void
): BrowserWindow {
  let x: number | undefined;
  let y: number | undefined;
  if (settings.miniBounds) {
    x = settings.miniBounds.x;
    y = settings.miniBounds.y;
  } else {
    const wa = screen.getPrimaryDisplay().workArea;
    x = wa.x + wa.width - WIDTH - 16;
    y = wa.y + wa.height - HEIGHT - 16;
  }

  mini = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    x,
    y,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mini.setAlwaysOnTop(true, "screen-saver");
  mini.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  const devUrl = process.env["ELECTRON_RENDERER_URL"];
  if (devUrl) {
    void mini.loadURL(`${devUrl}#mini`);
  } else {
    void mini.loadFile(join(__dirname, "../renderer/index.html"), {
      hash: "mini",
    });
  }

  mini.on("moved", () => {
    if (mini && !mini.isDestroyed()) onMoved(mini.getBounds());
  });
  mini.on("closed", () => {
    mini = null;
  });
  return mini;
}

export function sendToMini(state: TimerState): void {
  getMini()?.webContents.send("timer:state", state);
}

/** Show without stealing focus from whatever the user is doing. */
export function showMini(): void {
  const w = getMini();
  if (w && !w.isVisible()) w.showInactive();
}

export function hideMini(): void {
  getMini()?.hide();
}

export function destroyMini(): void {
  if (mini && !mini.isDestroyed()) mini.destroy();
  mini = null;
}
