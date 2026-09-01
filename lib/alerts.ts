import type { SupabaseClient } from "@supabase/supabase-js";

// Shared logic for the daily activity-alert summary (server route + cron).

export interface AlertThresholds {
  lunchMaxMin: number; // a single lunch break longer than this is flagged
  teaMaxMin: number; // a single tea (short) break longer than this is flagged
  minActiveMin: number; // less active work than this in a day is flagged
}

export const DEFAULT_THRESHOLDS: AlertThresholds = {
  lunchMaxMin: 60,
  teaMaxMin: 20,
  minActiveMin: 390, // 6.5h
};

export interface MemberSummary {
  userId: string;
  name: string;
  activeMin: number;
  lunchTotalMin: number;
  lunchMaxMin: number;
  teaTotalMin: number;
  teaMaxMin: number;
  flags: string[];
}

export interface DailySummary {
  date: string;
  members: MemberSummary[];
  flaggedCount: number;
  trackedCount: number;
}

function fmt(min: number): string {
  const m = Math.round(min);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

/** Aggregate breaks + activity for one day into per-member numbers and flags. */
export async function computeDailySummary(
  sb: SupabaseClient,
  date: string,
  th: AlertThresholds
): Promise<DailySummary> {
  const [membersRes, breaksRes, actRes] = await Promise.all([
    sb.from("team_members").select("id,name"),
    sb.from("breaks").select("user_id,type,minutes").eq("date", date),
    sb.from("activity_samples").select("user_id,active_seconds").eq("date", date),
  ]);

  const nameById = new Map<string, string>();
  for (const m of (membersRes.data as { id: string; name: string }[]) ?? [])
    nameById.set(m.id, m.name);

  interface Acc {
    active: number;
    lunchTotal: number;
    lunchMax: number;
    teaTotal: number;
    teaMax: number;
  }
  const acc = new Map<string, Acc>();
  const get = (id: string): Acc => {
    let a = acc.get(id);
    if (!a) {
      a = { active: 0, lunchTotal: 0, lunchMax: 0, teaTotal: 0, teaMax: 0 };
      acc.set(id, a);
    }
    return a;
  };

  for (const b of (breaksRes.data as {
    user_id: string;
    type: string;
    minutes: number;
  }[]) ?? []) {
    const a = get(b.user_id);
    if (b.type === "lunch") {
      a.lunchTotal += b.minutes;
      a.lunchMax = Math.max(a.lunchMax, b.minutes);
    } else if (b.type === "short") {
      a.teaTotal += b.minutes;
      a.teaMax = Math.max(a.teaMax, b.minutes);
    }
  }
  for (const s of (actRes.data as {
    user_id: string;
    active_seconds: number;
  }[]) ?? []) {
    get(s.user_id).active += s.active_seconds / 60;
  }

  const members: MemberSummary[] = [];
  for (const [userId, a] of acc.entries()) {
    const activeMin = Math.round(a.active);
    const flags: string[] = [];
    if (a.lunchMax > th.lunchMaxMin)
      flags.push(`🍽 lunch ${fmt(a.lunchMax)} (max ${fmt(th.lunchMaxMin)})`);
    if (a.teaMax > th.teaMaxMin)
      flags.push(`🍵 tea break ${fmt(a.teaMax)} (max ${fmt(th.teaMaxMin)})`);
    if (activeMin < th.minActiveMin)
      flags.push(`⏱ ${fmt(activeMin)} active (min ${fmt(th.minActiveMin)})`);
    members.push({
      userId,
      name: nameById.get(userId) ?? "Unknown",
      activeMin,
      lunchTotalMin: Math.round(a.lunchTotal),
      lunchMaxMin: a.lunchMax,
      teaTotalMin: Math.round(a.teaTotal),
      teaMaxMin: a.teaMax,
      flags,
    });
  }
  members.sort(
    (x, y) => y.flags.length - x.flags.length || y.activeMin - x.activeMin
  );

  return {
    date,
    members,
    flaggedCount: members.filter((m) => m.flags.length > 0).length,
    trackedCount: members.length,
  };
}

/** Render a summary as Slack mrkdwn. */
export function formatSummarySlack(
  summary: DailySummary,
  dateLabel: string
): string {
  const lines: string[] = [`🗂 *Daily activity summary* — ${dateLabel}`];
  if (summary.trackedCount === 0) {
    lines.push("No one tracked activity on this day.");
    return lines.join("\n");
  }
  lines.push(
    `${summary.flaggedCount} flag${summary.flaggedCount === 1 ? "" : "s"} across ${summary.trackedCount} tracked member${summary.trackedCount === 1 ? "" : "s"}.`
  );
  const flagged = summary.members.filter((m) => m.flags.length > 0);
  if (flagged.length) {
    lines.push("");
    for (const m of flagged) lines.push(`• *${m.name}* — ${m.flags.join("; ")}`);
  }
  const ok = summary.trackedCount - summary.flaggedCount;
  if (ok > 0) lines.push(`\n✅ ${ok} within limits.`);
  return lines.join("\n");
}

export function thresholdsFromSettings(
  general:
    | {
        alerts?: {
          lunch_max_min?: number;
          tea_max_min?: number;
          min_active_hours?: number;
        };
      }
    | null
    | undefined
): AlertThresholds {
  const a = general?.alerts ?? {};
  return {
    lunchMaxMin: a.lunch_max_min ?? DEFAULT_THRESHOLDS.lunchMaxMin,
    teaMaxMin: a.tea_max_min ?? DEFAULT_THRESHOLDS.teaMaxMin,
    minActiveMin:
      a.min_active_hours != null
        ? Math.round(a.min_active_hours * 60)
        : DEFAULT_THRESHOLDS.minActiveMin,
  };
}
