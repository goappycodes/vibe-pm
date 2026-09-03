import { claimSlackMessage } from "@/lib/slack/dedupe";
import { NextRequest, NextResponse } from "next/server";

// Posts daily updates to Slack: the team's standup channel, and — when the
// caller sends a batch — one message per project channel involved. Called from
// the "Post to Slack" action on My Day and the /updates composer. Keeps the bot
// token server-only.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Result = {
  ok: boolean;
  error?: string;
  dryRun?: boolean;
  duplicate?: boolean;
  channel: string;
};

async function postToSlack(channel: string, text: string): Promise<Result> {
  const token = process.env.SLACK_BOT_TOKEN;
  // Channel IDs (C0…/G0…) are used as-is; a plain name gets a leading #.
  const target = /^[CG][A-Z0-9]{6,}$/.test(channel)
    ? channel
    : `#${channel.replace(/^#/, "")}`;

  // A repeat of the same text to the same channel is a double-submit, not a
  // second update — report it as handled so the caller still logs it once.
  if (!claimSlackMessage(target, text)) {
    console.log(`[slack standup] duplicate suppressed for ${target}`);
    return { ok: true, duplicate: true, channel: target };
  }

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
  let body: { text?: unknown; channel?: unknown; messages?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }

  // The real standup channel is set via env (SLACK_STANDUP_CHANNEL, ideally a
  // channel ID the bot is in); the client's hint and a "standups" default are
  // fallbacks for local/dry-run use. Project messages carry their own channel.
  const fallbackChannel = (hint: unknown) =>
    process.env.SLACK_STANDUP_CHANNEL ||
    (typeof hint === "string" && hint) ||
    "standups";

  // Batch form: [{ text, channel? }, …] — the team channel plus one per project.
  if (Array.isArray(body.messages)) {
    const items = body.messages
      .map((m) => m as { text?: unknown; channel?: unknown })
      .map((m) => ({
        text: typeof m.text === "string" ? m.text.trim() : "",
        channel:
          typeof m.channel === "string" && m.channel
            ? m.channel
            : fallbackChannel(undefined),
      }))
      .filter((m) => m.text);
    if (!items.length) {
      return NextResponse.json({ ok: false, error: "empty" }, { status: 400 });
    }
    // Sequential: Slack rate-limits chat.postMessage per channel, and a handful
    // of messages is not worth racing.
    const results: Result[] = [];
    for (const m of items) results.push(await postToSlack(m.channel, m.text));
    return NextResponse.json({
      ok: results.some((r) => r.ok),
      results,
    });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json({ ok: false, error: "empty" }, { status: 400 });
  }
  const result = await postToSlack(fallbackChannel(body.channel), text);
  return NextResponse.json(result);
}
