// Vibe PM — Slack Socket Mode worker.
//
// Keeps a WebSocket open to Slack (no public URL needed) and turns Slack into
// tasks: the `/vibe` slash command and the "Add to Vibe PM" message shortcut.
// This is a long-running process — run it on an always-on host (a small VM,
// Railway/Render/Fly, or a box that stays up). It CANNOT run on Vercel
// serverless, which can't hold a socket open.
//
// Env (from .env.local): SLACK_BOT_TOKEN (xoxb-…), SLACK_APP_TOKEN (xapp-…,
// with connections:write), NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
//
// Run: node --env-file=.env.local scripts/slack-socket.mjs
import bolt from "@slack/bolt";
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

const { App } = bolt;

const botToken = process.env.SLACK_BOT_TOKEN;
const appToken = process.env.SLACK_APP_TOKEN;
const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

for (const [k, v] of Object.entries({
  SLACK_BOT_TOKEN: botToken,
  SLACK_APP_TOKEN: appToken,
  NEXT_PUBLIC_SUPABASE_URL: supaUrl,
  SUPABASE_SERVICE_ROLE_KEY: supaKey,
})) {
  if (!v) {
    console.error(`Missing ${k} in env.`);
    process.exit(1);
  }
}

const sb = createClient(supaUrl, supaKey, { auth: { persistSession: false } });

// These projects were seeded from Slack, so project.id === the channel id.
async function projectForChannel(channelId) {
  if (!channelId) return null;
  const { data } = await sb
    .from("projects")
    .select("id, name")
    .eq("id", channelId)
    .maybeSingle();
  return data ?? null;
}

async function memberForSlack(slackUserId) {
  if (!slackUserId) return null;
  const { data } = await sb
    .from("team_members")
    .select("id, name")
    .eq("slack_user_id", slackUserId)
    .maybeSingle();
  return data ?? null;
}

function extractUrgency(text) {
  const m = text.match(/(?:^|\s)!(low|medium|high|urgent)\b/i);
  if (!m) return { title: text.trim(), urgency: "medium" };
  return {
    title: text.replace(m[0], " ").replace(/\s+/g, " ").trim(),
    urgency: m[1].toLowerCase(),
  };
}

function appBase() {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://vibe-pm-six.vercel.app").replace(/\/$/, "");
}
const taskLink = (id) => `${appBase()}/board?task=${id}`;

async function createTask({ projectId, title, description = "", assigneeId = null, createdBy = null, urgency = "medium" }) {
  const id = "t_" + crypto.randomBytes(6).toString("hex");
  const { data: mx } = await sb
    .from("tasks")
    .select("order")
    .eq("project_id", projectId)
    .order("order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const order = (mx?.order ?? 0) + 1;
  const { data, error } = await sb
    .from("tasks")
    .insert({
      id,
      project_id: projectId,
      title: title.slice(0, 300) || "Untitled task",
      description: (description || "").slice(0, 4000),
      assignee_id: assigneeId,
      created_by: createdBy,
      status: "todo",
      urgency,
      order,
    })
    .select("id, title")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

const app = new App({ token: botToken, appToken, socketMode: true });

// /vibe <title>  ·  add !high / !urgent to flag priority
app.command("/vibe", async ({ command, ack, respond }) => {
  await ack();
  try {
    const text = (command.text || "").trim();
    if (!text) {
      await respond({ response_type: "ephemeral", text: "Usage: `/vibe <task title>`  ·  add `!high` or `!urgent` to flag priority." });
      return;
    }
    const project = await projectForChannel(command.channel_id);
    if (!project) {
      await respond({ response_type: "ephemeral", text: "This channel isn't linked to a Vibe PM project — run `/vibe` in a project channel." });
      return;
    }
    const member = await memberForSlack(command.user_id);
    const { title, urgency } = extractUrgency(text);
    const task = await createTask({ projectId: project.id, title, assigneeId: member?.id ?? null, createdBy: member?.id ?? null, urgency });
    await respond({
      response_type: "ephemeral",
      text: `:white_check_mark: Added *${title}* to *${project.name}*${member ? "" : " (unassigned — your Slack isn't linked to a member)"} — <${taskLink(task.id)}|open in Vibe PM>`,
    });
  } catch (e) {
    await respond({ response_type: "ephemeral", text: `:warning: Couldn't create the task: ${e.message}` });
  }
});

// "Add to Vibe PM" message shortcut (callback id: vibe_add_task)
app.shortcut("vibe_add_task", async ({ shortcut, ack, respond }) => {
  await ack();
  try {
    const channelId = shortcut.channel?.id;
    const userId = shortcut.user?.id;
    const msgText = (shortcut.message?.text || "").trim();
    const project = channelId ? await projectForChannel(channelId) : null;
    if (!project) {
      await respond({ response_type: "ephemeral", text: "This channel isn't linked to a Vibe PM project — try it in a project channel." });
      return;
    }
    const member = await memberForSlack(userId);
    const author = shortcut.message?.user ? await memberForSlack(shortcut.message.user) : null;
    const title = (msgText.split("\n")[0] || "Task from Slack").slice(0, 120);
    const description = `Added from Slack${author ? ` — originally posted by ${author.name}` : ""}.\n\n${msgText}`.slice(0, 4000);
    const task = await createTask({ projectId: project.id, title, description, assigneeId: member?.id ?? null, createdBy: member?.id ?? null });
    await respond({ response_type: "ephemeral", text: `:white_check_mark: Added *${title}* to *${project.name}* — <${taskLink(task.id)}|open in Vibe PM>` });
  } catch (e) {
    try { await respond({ response_type: "ephemeral", text: `:warning: Couldn't create the task: ${e.message}` }); } catch { /* no-op */ }
  }
});

const port = process.env.PORT || 3009;
await app.start(port);
console.log("⚡ Vibe PM Slack socket worker connected — /vibe and \"Add to Vibe PM\" are live.");
