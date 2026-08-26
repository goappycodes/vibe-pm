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

// Fixed "today" so the mock data never ages out of sync with its due dates.
export const TODAY = new Date("2026-08-26T00:00:00");

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
