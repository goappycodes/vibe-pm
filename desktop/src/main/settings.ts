import { app } from "electron";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface Settings {
  miniEnabled: boolean;
  miniBounds?: { x: number; y: number; width: number; height: number };
  // Auto-stop a running timer after prolonged OS input inactivity, so a
  // forgotten/overnight timer doesn't keep logging. Only affects mode "timer".
  idleAutoStop: boolean;
  idleStopMinutes: number; // minutes of no input before the timer auto-stops
}

const DEFAULTS: Settings = {
  miniEnabled: true,
  idleAutoStop: true,
  idleStopMinutes: 15,
};
const file = () => join(app.getPath("userData"), "settings.json");

export function loadSettings(): Settings {
  try {
    if (existsSync(file())) {
      return { ...DEFAULTS, ...JSON.parse(readFileSync(file(), "utf8")) };
    }
  } catch {
    /* corrupt/missing — fall back to defaults */
  }
  return { ...DEFAULTS };
}

export function saveSettings(s: Settings): void {
  try {
    writeFileSync(file(), JSON.stringify(s, null, 2));
  } catch (e) {
    console.error("[settings] save failed:", e);
  }
}
