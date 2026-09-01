import { app } from "electron";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// electron's setLoginItemSettings covers Windows + macOS well but is unreliable
// on Linux, so we manage a freedesktop autostart .desktop file there.
const LINUX_AUTOSTART_DIR = join(homedir(), ".config", "autostart");
const LINUX_DESKTOP_FILE = join(LINUX_AUTOSTART_DIR, "vibe-timer.desktop");

export function isAutoLaunchEnabled(): boolean {
  if (process.platform === "linux") return existsSync(LINUX_DESKTOP_FILE);
  return app.getLoginItemSettings().openAtLogin;
}

export function setAutoLaunch(enabled: boolean): void {
  if (process.platform === "linux") {
    try {
      if (enabled) {
        mkdirSync(LINUX_AUTOSTART_DIR, { recursive: true });
        const exec = process.execPath;
        writeFileSync(
          LINUX_DESKTOP_FILE,
          [
            "[Desktop Entry]",
            "Type=Application",
            "Name=Vibe Timer",
            `Exec=${exec}`,
            "Terminal=false",
            "X-GNOME-Autostart-enabled=true",
            "Hidden=false",
            "",
          ].join("\n")
        );
      } else if (existsSync(LINUX_DESKTOP_FILE)) {
        rmSync(LINUX_DESKTOP_FILE);
      }
    } catch (e) {
      // Unwritable ~/.config etc. — log and carry on so the IPC toggle
      // never rejects across the bridge.
      console.error("[autolaunch] linux autostart update failed:", e);
    }
    return;
  }

  try {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      // On macOS, launch straight into the tray without stealing a window at boot.
      openAsHidden: false,
    });
  } catch (e) {
    console.error("[autolaunch] setLoginItemSettings failed:", e);
  }
}
