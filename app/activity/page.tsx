"use client";

import { ActivityApprovals } from "@/components/ActivityApprovals";
import { ActivityDay, type ActivitySampleRow } from "@/components/ActivityDay";
import { ActivityTeam } from "@/components/ActivityTeam";
import { Avatar } from "@/components/Avatar";
import { useStore } from "@/lib/store";
import { supabase } from "@/lib/supabase/client";
import type { Break, TimeLog } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Loader2, ShieldAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

// The Activity dashboard shows LIVE time-tracking data (time_logs, breaks,
// activity_samples) which the desktop app writes under the real calendar date.
// So it defaults to the real "today" — deliberately NOT the frozen demo TODAY
// used by the seeded task views (My Day, Board, Time Log). Don't swap this for
// TODAY: it would default the dashboard to a day that never has tracked data.
function todayISO(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

type Mode = "team" | "person" | "approvals";

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

  const [mode, setMode] = useState<Mode>("team");
  const [userId, setUserId] = useState<string>("");
  const [date, setDate] = useState<string>(() => todayISO());
  const [data, setData] = useState<DayData | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    if (!userId && currentUser) setUserId(currentUser.id);
  }, [userId, currentUser]);

  // Pending-approval badge count.
  useEffect(() => {
    if (!supabase) return;
    void supabase
      .from("time_log_change_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .then(({ count }) => setPending(count ?? 0));
  }, []);

  // Person-mode day data.
  useEffect(() => {
    if (mode !== "person" || !userId || !date || !supabase) return;
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
  }, [mode, userId, date]);

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

  const openMember = (id: string) => {
    setUserId(id);
    setMode("person");
  };

  const tab = (m: Mode, label: string, badge?: number) => (
    <button
      onClick={() => setMode(m)}
      className={cn(
        "relative rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
        mode === m
          ? "bg-accent-soft text-accent"
          : "text-muted hover:bg-surface-2 hover:text-fg"
      )}
    >
      {label}
      {badge != null && badge > 0 && (
        <span className="ml-1.5 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
          {badge}
        </span>
      )}
    </button>
  );

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-6 py-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-fg">Activity</h2>
            <p className="text-sm text-muted">
              Time, breaks, and computer activity across the team.
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-xl border border-border bg-surface p-1">
            {tab("team", "Team")}
            {tab("person", "Person")}
            {tab("approvals", "Approvals", pending)}
          </div>
        </div>

        {mode !== "approvals" && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {mode === "person" && (
              <>
                {viewed && <Avatar member={viewed} size="md" />}
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
              </>
            )}
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg outline-none focus:border-accent"
            />
          </div>
        )}

        {mode === "team" && (
          <ActivityTeam date={date} onOpenMember={openMember} />
        )}

        {mode === "approvals" && (
          <ActivityApprovals
            reviewerId={currentUser?.id ?? ""}
            onCount={setPending}
          />
        )}

        {mode === "person" &&
          (loading && !data ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-6 w-6 animate-spin text-faint" />
            </div>
          ) : (
            <ActivityDay
              logs={data?.logs ?? []}
              breaks={data?.breaks ?? []}
              activity={data?.activity ?? []}
            />
          ))}
      </div>
    </div>
  );
}
