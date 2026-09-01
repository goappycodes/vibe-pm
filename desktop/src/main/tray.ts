import { app, Menu, nativeImage, Tray } from "electron";
import { join } from "node:path";

let tray: Tray | null = null;
let handlers: TrayHandlers | null = null;
let lastStatus = "Idle";

export interface TrayHandlers {
  onOpen: () => void;
  onQuit: () => void;
}

function resourcesDir(): string {
  return app.isPackaged
    ? process.resourcesPath
    : join(__dirname, "../../resources");
}

function buildMenu(status: string) {
  const menu = Menu.buildFromTemplate([
    { label: status, enabled: false },
    { type: "separator" },
    { label: "Open Vibe Timer", click: () => handlers?.onOpen() },
    { type: "separator" },
    { label: "Quit Vibe Timer", click: () => handlers?.onQuit() },
  ]);
  tray?.setContextMenu(menu);
}

export function createTray(opts: TrayHandlers): Tray {
  handlers = opts;
  const img = nativeImage
    .createFromPath(join(resourcesDir(), "tray.png"))
    .resize({ width: 18, height: 18 });
  tray = new Tray(img);
  tray.setToolTip("Vibe Timer");
  buildMenu(lastStatus);
  // Left click opens the window (Windows/Linux); on macOS it opens the menu by
  // default, so wire click too for parity.
  tray.on("click", () => opts.onOpen());
  return tray;
}

export function updateTrayStatus(status: string): void {
  if (!tray) return;
  lastStatus = status || "Idle";
  tray.setToolTip(`Vibe Timer — ${lastStatus}`);
  if (process.platform === "darwin") {
    tray.setTitle(lastStatus === "Idle" ? "" : ` ${lastStatus}`);
  }
  buildMenu(lastStatus);
}

export function destroyTray(): void {
  tray?.destroy();
  tray = null;
}
