import { BrowserWindow, screen, type Rectangle } from "electron";
import { join } from "node:path";
import type { Settings } from "./settings";
import type { TimerState } from "../preload/index";

const WIDTH = 194;
const HEIGHT = 44;

let mini: BrowserWindow | null = null;

export function getMini(): BrowserWindow | null {
  return mini && !mini.isDestroyed() ? mini : null;
}

/**
 * Whether a saved position still lands on a connected display. Guards against
 * restoring the window off-screen after a monitor is unplugged or the
 * resolution changes — otherwise the mini timer becomes invisible/unreachable.
 */
function boundsOnScreen(x: number, y: number): boolean {
  return screen.getAllDisplays().some((d) => {
    const wa = d.workArea;
    const overlapX =
      Math.min(x + WIDTH, wa.x + wa.width) - Math.max(x, wa.x);
    const overlapY =
      Math.min(y + HEIGHT, wa.y + wa.height) - Math.max(y, wa.y);
    return overlapX > 20 && overlapY > 20;
  });
}

function defaultPosition(): { x: number; y: number } {
  const wa = screen.getPrimaryDisplay().workArea;
  return {
    x: wa.x + wa.width - WIDTH - 16,
    y: wa.y + wa.height - HEIGHT - 16,
  };
}

/** Create the always-on-top mini timer window (hidden until shown). */
export function createMini(
  settings: Settings,
  onMoved: (b: Rectangle) => void
): BrowserWindow {
  let x: number;
  let y: number;
  if (
    settings.miniBounds &&
    boundsOnScreen(settings.miniBounds.x, settings.miniBounds.y)
  ) {
    x = settings.miniBounds.x;
    y = settings.miniBounds.y;
  } else {
    ({ x, y } = defaultPosition());
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
