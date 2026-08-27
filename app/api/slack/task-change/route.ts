import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

// Receives a Supabase Database Webhook on the `tasks` table and posts a compact
// summary to the task's project Slack channel. Fires for every door (UI, Claude,
// Slack) because it runs at the database layer.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATUS_LABEL: Record<string, string> = {
  backlog: "Backlog",
  todo: "To do",
  in_progress: "In progress",
  blocked: "Blocked",
  in_review: "In review",
  done: "Done",
};

type WebhookPayload = {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: Record<string, unknown> | null;
  old_record: Record<string, unknown> | null;
};

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

async function postToSlack(
  channel: string,
  text: string
): Promise<{ ok: boolean; error?: string; dryRun?: boolean }> {
  const token = process.env.SLACK_BOT_TOKEN;
  // Channel names (e.g. "salpido") need a leading #; IDs (C0…) are used as-is.
  const target = /^[CG][A-Z0-9]{6,}$/.test(channel) ? channel : `#${channel}`;
  if (!token) {
    console.log(`[slack dry-run] ${target}: ${text}`);
    return { ok: false, dryRun: true };
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
  if (!j.ok) console.error("[slack] postMessage failed:", j.error);
  return { ok: j.ok, error: j.error };
}

export async function POST(req: NextRequest) {
  // Optional shared-secret check (set SUPABASE_WEBHOOK_SECRET + a matching
  // header on the Supabase webhook).
  const secret = process.env.SUPABASE_WEBHOOK_SECRET;
  if (secret && req.headers.get("x-webhook-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: WebhookPayload;
  try {
    payload = (await req.json()) as WebhookPayload;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  if (payload.table !== "tasks") {
    return NextResponse.json({ ignored: "not tasks" });
  }

  const { type, record, old_record } = payload;
  const task = record ?? old_record;
  if (!task) return NextResponse.json({ ignored: "no record" });

  const sb = admin();
  const { data: project } = await sb
    .from("projects")
    .select("name, slack_channel_id")
    .eq("id", task.project_id as string)
    .maybeSingle();
  const channel = project?.slack_channel_id as string | null | undefined;
  if (!channel) return NextResponse.json({ ignored: "no channel" });

  const nameOf = async (id: unknown): Promise<string> => {
    if (!id) return "Unassigned";
    const { data } = await sb
      .from("team_members")
      .select("name")
      .eq("id", id as string)
      .maybeSingle();
    return (data?.name as string) ?? "someone";
  };
  const st = (s: unknown) => STATUS_LABEL[s as string] ?? String(s);

  let text: string;
  if (type === "INSERT") {
    const assignee = await nameOf(task.assignee_id);
    const due = task.due_date ? `  ·  due ${task.due_date}` : "";
    text = `:new: *New task* — *${task.title}*  ·  ${assignee}${due}  ·  ${st(task.status)}`;
  } else if (type === "DELETE") {
    text = `:wastebasket: *Task removed* — ${task.title}`;
  } else {
    const changes: string[] = [];
    if (record && old_record) {
      if (record.status !== old_record.status)
        changes.push(`status ${st(old_record.status)} → *${st(record.status)}*`);
      if (record.assignee_id !== old_record.assignee_id)
        changes.push(`assignee → ${await nameOf(record.assignee_id)}`);
      if (record.due_date !== old_record.due_date)
        changes.push(`due → ${record.due_date ?? "none"}`);
      if (record.title !== old_record.title)
        changes.push(`renamed to *${record.title}*`);
      if (record.urgency !== old_record.urgency)
        changes.push(`urgency → ${record.urgency}`);
    }
    if (!changes.length)
      return NextResponse.json({ ignored: "no notable change" });
    text = `:pencil2: *${record!.title}* — ${changes.join(", ")}`;
  }

  const result = await postToSlack(channel, text);
  return NextResponse.json({ channel, text, ...result });
}
