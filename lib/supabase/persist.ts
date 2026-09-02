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

/**
 * Record who is deleting, then delete — awaited in order so the row still
 * carries the actor when the delete trigger fires. The stamp changes no
 * notifiable field, so it posts nothing of its own.
 */
export function deleteTaskAs(id: string, actorId: string) {
  if (!supabase) return;
  const sb = supabase;
  markLocal(`tasks:${id}`);
  void (async () => {
    const stamp = await sb
      .from("tasks")
      .update({ updated_by: actorId })
      .eq("id", id);
    if (stamp.error)
      console.error("[persist] tasks stamp:", stamp.error.message);
    const del = await sb.from("tasks").delete().eq("id", id);
    if (del.error) console.error("[persist] tasks delete:", del.error.message);
  })();
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
