"use client";

import { Avatar } from "@/components/Avatar";
import { dayOverLogged } from "@/lib/activity";
import { useStore } from "@/lib/store";
import { supabase } from "@/lib/supabase/client";
import { formatDuration } from "@/lib/utils";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

interface Row {
  userId: string;
  logged: number;
  active: number;
  idle: number;
  brk: number;
}

export function ActivityTeam({
  date,
  onOpenMember,
}: {
  date: string;
  onOpenMember: (userId: string) => void;
}) {
  const members = useStore((s) => s.members);
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    if (!date) return;
    if (!supabase) {
      // No backend (demo mode) — nothing to fetch; show the empty state
      // instead of spinning forever.
      setRows([]);
      return;
    }
    let cancelled = false;
    setRows(null);
    (async () => {
      const [logs, breaks, activity] = await Promise.all([
        supabase.from("time_logs").select("user_id,minutes").eq("date", date),
        supabase.from("breaks").select("user_id,minutes").eq("date", date),
        supabase
          .from("activity_samples")
          .select("user_id,active_seconds,on_break")
          .eq("date", date),
      ]);
      if (cancelled) return;
      const map = new Map<string, Row>();
      const row = (id: string) => {
        let r = map.get(id);
        if (!r) {
          r = { userId: id, logged: 0, active: 0, idle: 0, brk: 0 };
          map.set(id, r);
        }
        return r;
      };
      for (const l of (logs.data as { user_id: string; minutes: number }[]) ?? [])
        row(l.user_id).logged += l.minutes;
      for (const b of (breaks.data as { user_id: string; minutes: number }[]) ?? [])
        row(b.user_id).brk += b.minutes;
      for (const a of (activity.data as {
        user_id: string;
        active_seconds: number;
        on_break: boolean;
      }[]) ?? []) {
        const r = row(a.user_id);
        r.active += a.active_seconds / 60;
        if (!a.on_break) r.idle += (60 - a.active_seconds) / 60;
      }
      const list = Array.from(map.values())
        .map((r) => ({
          ...r,
          active: Math.round(r.active),
          idle: Math.round(r.idle),
        }))
        .sort((a, b) => b.logged + b.active - (a.logged + a.active));
      setRows(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [date]);

  const memberById = useMemo(
    () => new Map(members.map((m) => [m.id, m])),
    [members]
  );

  if (!rows) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-faint" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm font-medium text-fg">No activity this day</p>
        <p className="text-xs text-faint">
          Nobody has tracked time or activity on {date}.
        </p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden p-0">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-faint">
            <th className="px-4 py-2.5 font-medium">Member</th>
            <th className="px-3 py-2.5 font-medium">Logged</th>
            <th className="hidden px-3 py-2.5 font-medium sm:table-cell">Active</th>
            <th className="hidden px-3 py-2.5 font-medium sm:table-cell">Idle</th>
            <th className="px-3 py-2.5 font-medium">Break</th>
            <th className="hidden px-4 py-2.5 font-medium md:table-cell">Split</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const m = memberById.get(r.userId);
            const total = r.active + r.idle + r.brk || 1;
            return (
              <tr
                key={r.userId}
                className="cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-surface-2"
                onClick={() => onOpenMember(r.userId)}
              >
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <Avatar member={m} size="sm" />
                    <span className="font-medium text-fg">
                      {m?.name ?? "Unknown"}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2.5 tabular-nums text-fg">
                  <span className="inline-flex items-center gap-1.5">
                    {formatDuration(r.logged)}
                    {dayOverLogged(r.logged, r.active, r.brk) && (
                      <AlertTriangle
                        className="h-3.5 w-3.5 text-amber-500"
                        aria-label="Logged time far exceeds recorded activity"
                      />
                    )}
                  </span>
                </td>
                <td className="hidden px-3 py-2.5 tabular-nums text-emerald-600 sm:table-cell dark:text-emerald-400">
                  {formatDuration(r.active)}
                </td>
                <td className="hidden px-3 py-2.5 tabular-nums text-muted sm:table-cell">
                  {formatDuration(r.idle)}
                </td>
                <td className="px-3 py-2.5 tabular-nums text-amber-600">
                  {formatDuration(r.brk)}
                </td>
                <td className="hidden px-4 py-2.5 md:table-cell">
                  <div className="flex h-2 w-36 overflow-hidden rounded-full bg-surface-2">
                    <span
                      className="bg-emerald-500"
                      style={{ width: `${(r.active / total) * 100}%` }}
                    />
                    <span
                      className="bg-slate-400"
                      style={{ width: `${(r.idle / total) * 100}%` }}
                    />
                    <span
                      className="bg-amber-400"
                      style={{ width: `${(r.brk / total) * 100}%` }}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
