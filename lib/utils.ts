import { clsx, type ClassValue } from "clsx";
import {
  differenceInCalendarDays,
  format,
  isValid,
  parseISO,
} from "date-fns";
import type { TeamMember } from "./types";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/** Midnight today, in the viewer's timezone. Always the real current date. */
export function today(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Today, resolved once per page load. Safe (and stable) for rendering and
 * for useMemo deps; anything that *writes* a date should call today() so a
 * session left open past midnight still records the right day.
 */
export const TODAY = today();

export function parseDate(d: string | null | undefined): Date | null {
  if (!d) return null;
  const parsed = parseISO(d);
  return isValid(parsed) ? parsed : null;
}

export function toISODate(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

/** Days from today (negative = overdue). */
export function daysFromToday(dateStr: string | null): number | null {
  const d = parseDate(dateStr);
  if (!d) return null;
  return differenceInCalendarDays(d, TODAY);
}

export interface RelativeDue {
  label: string;
  tone: "overdue" | "today" | "soon" | "future" | "none";
}

export function relativeDue(dateStr: string | null): RelativeDue {
  const diff = daysFromToday(dateStr);
  if (diff === null) return { label: "—", tone: "none" };
  if (diff < 0) {
    const n = Math.abs(diff);
    return { label: n === 1 ? "1d overdue" : `${n}d overdue`, tone: "overdue" };
  }
  if (diff === 0) return { label: "Today", tone: "today" };
  if (diff === 1) return { label: "Tomorrow", tone: "soon" };
  if (diff <= 6) return { label: `${diff}d`, tone: "soon" };
  const d = parseDate(dateStr)!;
  return { label: format(d, "MMM d"), tone: "future" };
}

/** How long a task took: created → completed. Null if not completed. */
export function cycleTime(
  createdAt: string | null,
  completedAt: string | null
): { short: string; long: string } | null {
  const c = parseDate(createdAt);
  const d = parseDate(completedAt);
  if (!c || !d) return null;
  const ms = d.getTime() - c.getTime();
  if (ms < 0) return null;
  const mins = Math.round(ms / 60000);
  if (mins < 60) {
    const m = Math.max(1, mins);
    return { short: mins < 1 ? "<1m" : `${m}m`, long: mins < 1 ? "under a minute" : `${m} min` };
  }
  const hours = ms / 3_600_000;
  if (hours < 24) {
    const h = Math.round(hours);
    return { short: `${h}h`, long: `${h} hour${h === 1 ? "" : "s"}` };
  }
  const days = Math.round(ms / 86_400_000);
  return { short: `${days}d`, long: `${days} day${days === 1 ? "" : "s"}` };
}

export function formatDate(dateStr: string | null): string {
  const d = parseDate(dateStr);
  if (!d) return "—";
  return format(d, "MMM d");
}

export function formatDateLong(dateStr: string | null): string {
  const d = parseDate(dateStr);
  if (!d) return "No date";
  return format(d, "EEE, MMM d, yyyy");
}

const AVATAR_TONES = [
  "bg-indigo-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-sky-500",
  "bg-violet-500",
  "bg-teal-500",
  "bg-fuchsia-500",
  "bg-orange-500",
  "bg-cyan-500",
];

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function avatarTone(member: TeamMember | undefined | null): string {
  if (!member) return "bg-gray-400";
  const idx = member.id
    .split("")
    .reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_TONES[idx % AVATAR_TONES.length];
}

export function firstName(name: string): string {
  return name.split(/\s+/)[0];
}

/** Minutes between two "HH:MM" clock times. Null if unparseable or not positive. */
export function minutesBetween(start: string, end: string): number | null {
  const toMinutes = (s: string) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h > 23 || min > 59) return null;
    return h * 60 + min;
  };
  const a = toMinutes(start);
  const b = toMinutes(end);
  if (a === null || b === null) return null;
  return b > a ? b - a : null;
}

/** 150 → "2h 30m" */
export function formatDuration(minutes: number): string {
  if (minutes <= 0) return "0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** 150 → 2.5 — the shape spreadsheets can sum. */
export function decimalHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}

/** "09:50" + 25 → "10:15". Clamps at 23:59 rather than wrapping past midnight. */
/** Now as "HH:MM", rounded down to a 5-minute mark. */
export function nowClock(step = 5): string {
  const d = new Date();
  const mins = Math.floor(d.getMinutes() / step) * step;
  return `${String(d.getHours()).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

export function addMinutesToClock(hhmm: string, mins: number): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return hhmm;
  const total = Math.min(23 * 60 + 59, Number(m[1]) * 60 + Number(m[2]) + mins);
  const h = Math.floor(total / 60);
  const min = total % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** "14:05" → "2:05 pm" */
export function formatClock(hhmm: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return hhmm;
  const h = Number(m[1]);
  const suffix = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m[2]} ${suffix}`;
}
