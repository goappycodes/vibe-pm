"use client";

import { supabase } from "./client";

// Track rows we just wrote locally so realtime echoes of our own changes don't
// clobber fresher in-memory state.
const recent = new Map<string, number>();
const WINDOW = 2500;

export function markLocal(key: string) {
  recent.set(key, Date.now());
}

export function isRecentLocal(key: string) {
  const t = recent.get(key);
  if (t === undefined) return false;
  if (Date.now() - t > WINDOW) {
    recent.delete(key);
    return false;
  }
  return true;
}

function keyOf(table: string, row: Record<string, unknown>) {
  if (table === "task_dependencies") {
    return `${table}:${row.task_id}|${row.depends_on_task_id}`;
  }
  if (table === "app_settings") return `${table}:1`;
  return `${table}:${row.id}`;
}

/** Fire-and-forget upsert — keeps the UI instant; errors are logged, not thrown. */
export function upsertRows(table: string, rows: object[]) {
  if (!supabase || rows.length === 0) return;
  rows.forEach((r) => markLocal(keyOf(table, r as Record<string, unknown>)));
  void supabase
    .from(table)
    .upsert(rows as Record<string, unknown>[])
    .then(({ error }) => {
      if (error) console.error(`[persist] ${table} upsert:`, error.message);
    });
}

export function deleteRow(table: string, match: Record<string, unknown>) {
  if (!supabase) return;
  markLocal(keyOf(table, match));
  void supabase
    .from(table)
    .delete()
    .match(match)
    .then(({ error }) => {
      if (error) console.error(`[persist] ${table} delete:`, error.message);
    });
}
