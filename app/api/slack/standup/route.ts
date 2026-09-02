import { claimSlackMessage } from "@/lib/slack/dedupe";
import { NextRequest, NextResponse } from "next/server";

// Posts a daily standup (a member's plan for the day) to the team's Slack
// standup channel. Called from the "Post to Slack" action on My Day and the
// /updates composer. Keeps the bot token server-only.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function postToSlack(
  channel: string,
  text: string
): Promise<{ ok: boolean; error?: string; dryRun?: boolean; channel: string }> {
  const token = process.env.SLACK_BOT_TOKEN;
  // Channel IDs (C0…/G0…) are used as-is; a plain name gets a leading #.
  const target = /^[CG][A-Z0-9]{6,}$/.test(channel)
    ? channel
    : `#${channel.replace(/^#/, "")}`;
  if (!token) {
    console.log(`[slack standup dry-run] ${target}:\n${text}`);
    return { ok: false, dryRun: true, channel: target };
  }
  const r = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ channel: target, text, unfurl_links: false }),
  });
  const j = (await r.json()) as { ok: boolean; error?: string };
  if (!j.ok) console.error("[slack standup] postMessage failed:", j.error);
  return { ok: j.ok, error: j.error, channel: target };
}

export async function POST(req: NextRequest) {
  let body: { text?: unknown; channel?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json({ ok: false, error: "empty" }, { status: 400 });
  }

  // The real standup channel is set via env (SLACK_STANDUP_CHANNEL, ideally a
  // channel ID the bot is in); the client's hint and a "standups" default are
  // fallbacks for local/dry-run use.
  const hint = typeof body.channel === "string" ? body.channel : "";
  const channel =
    process.env.SLACK_STANDUP_CHANNEL || hint || "standups";

  // A second identical standup within the window is a double-submit, not a
  // second standup — report it as handled so the caller still logs it once.
  if (!claimSlackMessage(channel, text)) {
    console.log(`[slack standup] duplicate suppressed for ${channel}`);
    return NextResponse.json({ ok: true, duplicate: true, channel });
  }

  const result = await postToSlack(channel, text);
  return NextResponse.json(result);
}
