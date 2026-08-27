import { NextRequest, NextResponse } from "next/server";
import {
  admin,
  createTask,
  extractUrgency,
  memberForSlack,
  projectForChannel,
  taskLink,
  verifySlack,
} from "@/lib/slack/inbound";

// Slack slash command: `/vibe <title>` creates a task in the project mapped to
// the current channel, assigned to the invoking member. Add `!high` / `!urgent`
// to flag priority. The DB trigger posts the shared ":new:" note to the channel;
// the reply here is ephemeral (only the invoker sees it).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ephemeral = (text: string) =>
  NextResponse.json({ response_type: "ephemeral", text });

export async function POST(req: NextRequest) {
  const secret = process.env.SLACK_SIGNING_SECRET;
  const raw = await req.text();
  if (
    !secret ||
    !verifySlack(
      raw,
      req.headers.get("x-slack-request-timestamp"),
      req.headers.get("x-slack-signature"),
      secret
    )
  ) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const p = new URLSearchParams(raw);
  const text = (p.get("text") || "").trim();
  const channelId = p.get("channel_id") || "";
  const userId = p.get("user_id") || "";

  if (!text) {
    return ephemeral(
      "Usage: `/vibe <task title>`  ·  add `!high` or `!urgent` to flag priority."
    );
  }

  const sb = admin();
  const project = await projectForChannel(sb, channelId);
  if (!project) {
    return ephemeral(
      "This channel isn't linked to a Vibe PM project — run `/vibe` in a project channel."
    );
  }

  const member = await memberForSlack(sb, userId);
  const { title, urgency } = extractUrgency(text);

  try {
    const task = await createTask(sb, {
      projectId: project.id,
      title,
      assigneeId: member?.id ?? null,
      createdBy: member?.id ?? null,
      urgency,
    });
    return ephemeral(
      `:white_check_mark: Added *${title}* to *${project.name}*${
        member ? "" : " (unassigned — your Slack isn't linked to a member)"
      } — <${taskLink(task.id)}|open in Vibe PM>`
    );
  } catch (e) {
    return ephemeral(`:warning: Couldn't create the task: ${(e as Error).message}`);
  }
}
