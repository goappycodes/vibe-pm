"use client";

import { ActivityDay, type ActivitySampleRow } from "@/components/ActivityDay";
import { Avatar } from "@/components/Avatar";
import { useStore } from "@/lib/store";
import { supabase } from "@/lib/supabase/client";
import type { Break, TimeLog } from "@/lib/types";
import { Loader2, ShieldAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

function todayISO(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

interface DayData {
  logs: TimeLog[];
  breaks: Break[];
  activity: ActivitySampleRow[];
}

export default function ActivityPage() {
  const members = useStore((s) => s.members);
  const currentUser = useStore((s) =>
    s.members.find((m) => m.id === s.currentUserId)
  );
  const isLead =
    currentUser?.role === "admin" || currentUser?.role === "team_lead";

  const [userId, setUserId] = useState<string>("");
  const [date, setDate] = useState<string>(() => todayISO());
  const [data, setData] = useState<DayData | null>(null);
  const [loading, setLoading] = useState(false);

  // Default to viewing yourself once members hydrate.
  useEffect(() => {
    if (!userId && currentUser) setUserId(currentUser.id);
  }, [userId, currentUser]);

  useEffect(() => {
    if (!userId || !date || !supabase) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [l, b, a] = await Promise.all([
        supabase.from("time_logs").select("*").eq("user_id", userId).eq("date", date),
        supabase.from("breaks").select("*").eq("user_id", userId).eq("date", date),
        supabase
          .from("activity_samples")
          .select("minute,active_seconds,task_id,on_break")
          .eq("user_id", userId)
          .eq("date", date),
      ]);
      if (cancelled) return;
      setData({
        logs: (l.data as TimeLog[]) ?? [],
        breaks: (b.data as Break[]) ?? [],
        activity: (a.data as ActivitySampleRow[]) ?? [],
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, date]);

  const sortedMembers = useMemo(
    () => [...members].sort((a, b) => a.name.localeCompare(b.name)),
    [members]
  );
  const viewed = members.find((m) => m.id === userId);

  if (!isLead) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="max-w-sm text-center">
          <ShieldAlert className="mx-auto h-9 w-9 text-amber-500" />
          <h1 className="mt-3 text-lg font-semibold text-fg">Admins & leads only</h1>
          <p className="mt-1 text-sm text-muted">
            Activity dashboards are visible to admins and team leads. Ask an admin
            if you need access.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-6 py-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {viewed && <Avatar member={viewed} size="md" />}
            <div>
              <h2 className="text-xl font-semibold text-fg">Activity</h2>
              <p className="text-sm text-muted">
                How {viewed?.name?.split(" ")[0] ?? "the day"} spent the day —
                tasks, breaks, and computer activity.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg outline-none focus:border-accent"
            >
              {sortedMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg outline-none focus:border-accent"
            />
          </div>
        </div>

        {loading && !data ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-faint" />
          </div>
        ) : (
          <ActivityDay
            logs={data?.logs ?? []}
            breaks={data?.breaks ?? []}
            activity={data?.activity ?? []}
          />
        )}
      </div>
    </div>
  );
}
