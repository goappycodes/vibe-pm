"use client";

import { Avatar } from "@/components/Avatar";
import { useStore } from "@/lib/store";
import { supabase } from "@/lib/supabase/client";
import type { TimeLog, TimeLogChangeRequest } from "@/lib/types";
import { formatDuration, minutesBetween } from "@/lib/utils";
import { Check, Clock, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const genId = (p: string) =>
  `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

const TYPE_META = {
  edit: { label: "Edit", icon: Pencil, cls: "text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10" },
  add: { label: "Add", icon: Plus, cls: "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10" },
  delete: { label: "Delete", icon: Trash2, cls: "text-rose-600 bg-rose-50 dark:bg-rose-500/10" },
} as const;

export function ActivityApprovals({
  reviewerId,
  onCount,
}: {
  reviewerId: string;
  onCount?: (n: number) => void;
}) {
  const members = useStore((s) => s.members);
  const tasks = useStore((s) => s.tasks);
  const [requests, setRequests] = useState<TimeLogChangeRequest[] | null>(null);
  const [originals, setOriginals] = useState<Record<string, TimeLog>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const memberName = (id: string) =>
    members.find((m) => m.id === id)?.name ?? "Someone";
  const taskName = (id: string | null | undefined) =>
    tasks.find((t) => t.id === id)?.title ?? "—";

  const load = useCallback(async () => {
    if (!supabase) {
      // No backend (demo mode) — nothing to load; show the empty state.
      setRequests([]);
      onCount?.(0);
      return;
    }
    const { data } = await supabase
      .from("time_log_change_requests")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    const reqs = (data as TimeLogChangeRequest[]) ?? [];
    setRequests(reqs);
    onCount?.(reqs.length);

    const ids = reqs
      .map((r) => r.time_log_id)
      .filter((x): x is string => !!x);
    if (ids.length) {
      const { data: logs } = await supabase
        .from("time_logs")
        .select("*")
        .in("id", ids);
      const map: Record<string, TimeLog> = {};
      for (const l of (logs as TimeLog[]) ?? []) map[l.id] = l;
      setOriginals(map);
    }
  }, [onCount]);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (
    req: TimeLogChangeRequest,
    status: "approved" | "rejected"
  ) => {
    if (!supabase || busy) return;
    setBusy(req.id);
    const now = new Date().toISOString();
    const p = req.payload;

    if (status === "approved") {
      if (req.type === "edit" && req.time_log_id) {
        await supabase
          .from("time_logs")
          .update({
            task_id: p.task_id ?? null,
            project_id: p.project_id ?? null,
            date: p.date,
            start_time: p.start_time,
            end_time: p.end_time,
            minutes: minutesBetween(p.start_time ?? "", p.end_time ?? "") ?? 0,
            modified: true,
            edited_by: reviewerId,
            edited_at: now,
          })
          .eq("id", req.time_log_id);
      } else if (req.type === "add") {
        await supabase.from("time_logs").insert({
          id: genId("tl"),
          user_id: req.user_id,
          task_id: p.task_id ?? null,
          project_id: p.project_id ?? null,
          date: p.date,
          start_time: p.start_time,
          end_time: p.end_time,
          minutes: minutesBetween(p.start_time ?? "", p.end_time ?? "") ?? 0,
          note: p.note ?? "",
          modified: true,
          edited_by: reviewerId,
          edited_at: now,
        });
      } else if (req.type === "delete" && req.time_log_id) {
        await supabase.from("time_logs").delete().eq("id", req.time_log_id);
      }
    }

    await supabase
      .from("time_log_change_requests")
      .update({ status, reviewer_id: reviewerId, reviewed_at: now })
      .eq("id", req.id);

    setBusy(null);
    await load();
  };

  if (!requests) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-faint" />
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border py-16 text-center">
        <Check className="mx-auto h-8 w-8 text-emerald-500" />
        <p className="mt-2 text-sm font-medium text-fg">All caught up</p>
        <p className="text-xs text-faint">No time-entry changes awaiting review.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {requests.map((req) => {
        const meta = TYPE_META[req.type];
        const Icon = meta.icon;
        const orig = req.time_log_id ? originals[req.time_log_id] : undefined;
        const p = req.payload;
        return (
          <div key={req.id} className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${meta.cls}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <div className="text-sm font-medium text-fg">
                    {memberName(req.user_id)}{" "}
                    <span className="font-normal text-muted">
                      requested to {meta.label.toLowerCase()} an entry
                    </span>
                  </div>
                  {req.note && (
                    <div className="text-xs text-faint">“{req.note}”</div>
                  )}
                </div>
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => decide(req, "rejected")}
                  disabled={busy === req.id}
                  className="btn-ghost gap-1.5 text-xs text-muted disabled:opacity-40"
                >
                  <X className="h-3.5 w-3.5" /> Reject
                </button>
                <button
                  onClick={() => decide(req, "approved")}
                  disabled={busy === req.id}
                  className="btn-primary gap-1.5 text-xs disabled:opacity-40"
                >
                  {busy === req.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  Approve
                </button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              {req.type === "delete" ? (
                orig && (
                  <span className="rounded-md bg-surface-2 px-2 py-1 text-muted line-through">
                    {taskName(orig.task_id)} · {orig.date} · {orig.start_time}–
                    {orig.end_time} · {formatDuration(orig.minutes)}
                  </span>
                )
              ) : (
                <>
                  {orig && (
                    <>
                      <span className="rounded-md bg-surface-2 px-2 py-1 text-muted line-through">
                        {taskName(orig.task_id)} · {orig.start_time}–{orig.end_time}
                      </span>
                      <span className="text-faint">→</span>
                    </>
                  )}
                  <span className="flex items-center gap-1 rounded-md bg-accent-soft px-2 py-1 text-accent">
                    <Clock className="h-3 w-3" />
                    {taskName(p.task_id)} · {p.date} · {p.start_time}–{p.end_time}
                    {p.start_time && p.end_time && (
                      <span className="text-muted">
                        {" "}
                        · {formatDuration(minutesBetween(p.start_time, p.end_time) ?? 0)}
                      </span>
                    )}
                  </span>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
