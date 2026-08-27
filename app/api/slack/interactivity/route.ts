import { NextRequest, NextResponse } from "next/server";
import {
  admin,
  createTask,
  memberForSlack,
  projectForChannel,
  taskLink,
  verifySlack,
} from "@/lib/slack/inbound";

// Slack interactivity endpoint. Handles the "Add to Vibe PM" message shortcut
// (message_action): turns the picked message into a task in the channel's
// project. The ephemeral confirmation goes back via response_url.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function replyEphemeral(url: string | undefined, text: string) {
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ response_type: "ephemeral", text }),
    });
  } catch {
    /* best effort */
  }
}

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

  let payload: {
    type?: string;
    callback_id?: string;
    channel?: { id?: string };
    user?: { id?: string };
    response_url?: string;
    message?: { text?: string; user?: string };
  };
  try {
    payload = JSON.parse(new URLSearchParams(raw).get("payload") || "{}");
  } catch {
    return NextResponse.json({ ok: false });
  }

  const isAddTask =
    payload.type === "message_action" &&
    (payload.callback_id === "vibe_add_task" ||
      payload.callback_id === "add_task");
  if (!isAddTask) return NextResponse.json({});

  const channelId = payload.channel?.id ?? "";
  const userId = payload.user?.id ?? "";
  const responseUrl = payload.response_url;
  const msgText = (payload.message?.text || "").trim();

  const sb = admin();
  const project = await projectForChannel(sb, channelId);
  if (!project) {
    await replyEphemeral(
      responseUrl,
      "This channel isn't linked to a Vibe PM project — try it in a project channel."
    );
    return NextResponse.json({});
  }

  const member = await memberForSlack(sb, userId);
  const author = payload.message?.user
    ? await memberForSlack(sb, payload.message.user)
    : null;
  const title = (msgText.split("\n")[0] || "Task from Slack").slice(0, 120);
  const description = `Added from Slack${
    author ? ` — originally posted by ${author.name}` : ""
  }.\n\n${msgText}`.slice(0, 4000);

  try {
    const task = await createTask(sb, {
      projectId: project.id,
      title,
      description,
      assigneeId: member?.id ?? null,
      createdBy: member?.id ?? null,
    });
    await replyEphemeral(
      responseUrl,
      `:white_check_mark: Added *${title}* to *${project.name}* — <${taskLink(
        task.id
      )}|open in Vibe PM>`
    );
  } catch (e) {
    await replyEphemeral(
      responseUrl,
      `:warning: Couldn't create the task: ${(e as Error).message}`
    );
  }
  return NextResponse.json({});
}
