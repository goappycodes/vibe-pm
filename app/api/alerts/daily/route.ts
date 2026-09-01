import {
  computeDailySummary,
  formatSummarySlack,
  thresholdsFromSettings,
} from "@/lib/alerts";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

// Daily activity-alert summary. Triggered by Vercel Cron (see vercel.json) and
// previewable from Settings. Computes yesterday's breaks/activity per member,
// flags breaches, and DMs admins on Slack (channel fallback).
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function serverClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/** yyyy-mm-dd for a date, in the given IANA timezone. */
function ymdInTz(d: Date, tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

async function postToSlack(target: string, text: string): Promise<boolean> {
  const token = process.env.SLACK_BOT_TOKEN;
  // U… = DM a user; C…/G… = channel/group id; otherwise a #name.
  const channel = /^[UWCG][A-Z0-9]{6,}$/.test(target)
    ? target
    : `#${target.replace(/^#/, "")}`;
  if (!token) {
    console.log(`[alerts dry-run] ${channel}:\n${text}`);
    return false;
  }
  const r = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ channel, text, unfurl_links: false }),
  });
  const j = (await r.json()) as { ok: boolean; error?: string };
  if (!j.ok) console.error("[alerts] postMessage failed:", channel, j.error);
  return j.ok;
}

export async function GET(req: NextRequest) {
  const sb = serverClient();
  if (!sb) {
    return NextResponse.json(
      { ok: false, error: "Supabase not configured" },
      { status: 500 }
    );
  }

  const params = req.nextUrl.searchParams;
  const preview = params.get("preview") === "1";

  // Sending requires the cron secret (when set). Preview is read-only + open,
  // matching the app's existing (permissive) data-access posture.
  if (!preview) {
    const secret = process.env.CRON_SECRET;
    if (secret) {
      const authz = req.headers.get("authorization") ?? "";
      const key = params.get("key") ?? "";
      if (authz !== `Bearer ${secret}` && key !== secret) {
        return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
      }
    }
  }

  // Settings (timezone + thresholds + enabled).
  const { data: settingsRow } = await sb
    .from("app_settings")
    .select("general")
    .eq("id", 1)
    .single();
  const general = (settingsRow?.general as {
    timezone?: string;
    alerts?: {
      enabled?: boolean;
      lunch_max_min?: number;
      tea_max_min?: number;
      min_active_hours?: number;
    };
  } | null) ?? null;
  const tz = general?.timezone || "Asia/Kolkata";
  const thresholds = thresholdsFromSettings(general);

  const date =
    params.get("date") || ymdInTz(new Date(Date.now() - 24 * 3600 * 1000), tz);

  const summary = await computeDailySummary(sb, date, thresholds);
  let dateLabel = date;
  try {
    dateLabel = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(new Date(`${date}T12:00:00Z`));
  } catch {
    /* keep ISO */
  }
  const text = formatSummarySlack(summary, dateLabel);

  if (preview) {
    return NextResponse.json({ ok: true, date, summary, text, preview: true });
  }

  if (general?.alerts?.enabled === false) {
    return NextResponse.json({ ok: true, date, skipped: "alerts disabled" });
  }

  // Recipients: admins with a Slack id (DM), else a channel fallback.
  const { data: admins } = await sb
    .from("team_members")
    .select("slack_user_id,role")
    .eq("role", "admin");
  const dmTargets = ((admins as { slack_user_id: string | null }[]) ?? [])
    .map((a) => a.slack_user_id)
    .filter((x): x is string => !!x);

  const targets = dmTargets.length
    ? dmTargets
    : [
        process.env.SLACK_ALERTS_CHANNEL ||
          process.env.SLACK_STANDUP_CHANNEL ||
          "standups",
      ];

  const results = await Promise.all(targets.map((t) => postToSlack(t, text)));
  const sent = results.filter(Boolean).length;

  return NextResponse.json({
    ok: true,
    date,
    flagged: summary.flaggedCount,
    tracked: summary.trackedCount,
    targets: targets.length,
    sent,
    dryRun: !process.env.SLACK_BOT_TOKEN,
  });
}
