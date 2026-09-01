const APP_TODAY = import.meta.env.VITE_APP_TODAY?.trim();

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * The calendar date rows are written/looked-up under. Pinned to the web app's
 * frozen "today" via VITE_APP_TODAY so day-plans and time_logs line up with the
 * web views; falls back to the real date when that env is empty.
 */
export function todayISO(): string {
  return APP_TODAY && APP_TODAY.length > 0 ? APP_TODAY : toISODate(new Date());
}

export function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
}

export function addMinutesToHHMM(clock: string, mins: number): string {
  const [h, m] = clock.split(":").map(Number);
  const total = (((h * 60 + m + mins) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(
    total % 60
  ).padStart(2, "0")}`;
}

/** Whole minutes elapsed since an epoch-ms start, at least 1. */
export function minutesSince(startedAt: number): number {
  return Math.max(1, Math.round((Date.now() - startedAt) / 60000));
}

export function fmtDuration(min: number): string {
  if (min <= 0) return "0m";
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function fmtDate(iso: string): string {
  // "2026-08-26" -> "Aug 26" (avoids a date lib; local parse)
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[m - 1]} ${d}, ${y}`;
}

export function fmtElapsed(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}
