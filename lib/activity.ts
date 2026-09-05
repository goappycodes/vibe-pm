// Heuristics for spotting time logs that far exceed real computer activity —
// e.g. a timer left running overnight — plus helpers to compute the active
// portion of a specific log window so a lead can trim it back to real work.

export interface MinuteSample {
  minute: string; // "HH:MM"
  active_seconds: number; // 0..60
  on_break: boolean;
}

const toMin = (s: string): number => {
  const [h, m] = s.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** Clamp minutes-of-day back to an "HH:MM" clock (wraps at midnight). */
export function addMinutesClock(clock: string, mins: number): string {
  const total = (((toMin(clock) + mins) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(
    total % 60
  ).padStart(2, "0")}`;
}

// A day looks over-logged when a lot of time was logged but real activity
// (active input + breaks) accounts for less than half of it.
export const OVERLOG_DAY_FLOOR_MIN = 120;
export const OVERLOG_RATIO = 0.5;

export function dayOverLogged(
  loggedMin: number,
  activeMin: number,
  breakMin: number
): boolean {
  return (
    loggedMin >= OVERLOG_DAY_FLOOR_MIN &&
    activeMin + breakMin < loggedMin * OVERLOG_RATIO
  );
}

/** Active minutes (rounded) recorded inside a [start,end) clock window. */
export function activeMinutesInWindow(
  samples: MinuteSample[],
  startTime: string,
  endTime: string
): number {
  const lo = toMin(startTime);
  const hi = toMin(endTime);
  const secs = samples.reduce((s, a) => {
    const m = toMin(a.minute);
    return m >= lo && m < hi ? s + a.active_seconds : s;
  }, 0);
  return Math.round(secs / 60);
}

// A single entry looks over-logged when it's long yet its own window saw
// little activity.
export const OVERLOG_ENTRY_FLOOR_MIN = 90;

export function entryOverLogged(
  logMinutes: number,
  activeMinInWindow: number
): boolean {
  return (
    logMinutes >= OVERLOG_ENTRY_FLOOR_MIN &&
    activeMinInWindow < logMinutes * OVERLOG_RATIO
  );
}
