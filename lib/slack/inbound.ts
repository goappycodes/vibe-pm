import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

// Server-only helpers for Slack inbound (slash command + message shortcut).
// Never import this into client code — it uses the service-role key.

/**
 * Verify a request really came from Slack using the app Signing Secret.
 * https://api.slack.com/authentication/verifying-requests-from-slack
 */
export function verifySlack(
  rawBody: string,
  timestamp: string | null,
  signature: string | null,
  secret: string
): boolean {
  if (!timestamp || !signature) return false;
  const now = Math.floor(Date.now() / 1000);
  // Reject stale requests (replay protection).
  if (Math.abs(now - Number(timestamp)) > 300) return false;
  const base = `v0:${timestamp}:${rawBody}`;
  const mine = "v0=" + crypto.createHmac("sha256", secret).update(base).digest("hex");
  const a = Buffer.from(mine);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function admin(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export function appBase(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL || "https://vibe-pm-six.vercel.app"
  ).replace(/\/$/, "");
}

export function taskLink(id: string): string {
  return `${appBase()}/board?task=${id}`;
}

// These projects were seeded from Slack, so project.id === the channel id.
export async function projectForChannel(
  sb: SupabaseClient,
  channelId: string
): Promise<{ id: string; name: string } | null> {
  if (!channelId) return null;
  const { data } = await sb
    .from("projects")
    .select("id, name")
    .eq("id", channelId)
    .maybeSingle();
  return (data as { id: string; name: string } | null) ?? null;
}

export async function memberForSlack(
  sb: SupabaseClient,
  slackUserId: string
): Promise<{ id: string; name: string } | null> {
  if (!slackUserId) return null;
  const { data } = await sb
    .from("team_members")
    .select("id, name")
    .eq("slack_user_id", slackUserId)
    .maybeSingle();
  return (data as { id: string; name: string } | null) ?? null;
}

const URGENCIES = new Set(["low", "medium", "high", "urgent"]);

/** Pull a trailing `!high` / `!urgent` flag out of the title text. */
export function extractUrgency(text: string): { title: string; urgency: string } {
  const m = text.match(/(?:^|\s)!(low|medium|high|urgent)\b/i);
  if (!m) return { title: text.trim(), urgency: "medium" };
  const urgency = m[1].toLowerCase();
  return {
    title: text.replace(m[0], " ").replace(/\s+/g, " ").trim(),
    urgency: URGENCIES.has(urgency) ? urgency : "medium",
  };
}

export async function createTask(
  sb: SupabaseClient,
  opts: {
    projectId: string;
    title: string;
    description?: string;
    assigneeId?: string | null;
    createdBy?: string | null;
    urgency?: string;
  }
): Promise<{ id: string; title: string }> {
  const id = "t_" + crypto.randomBytes(6).toString("hex");
  const { data: mx } = await sb
    .from("tasks")
    .select("order")
    .eq("project_id", opts.projectId)
    .order("order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const order = (((mx as { order?: number } | null)?.order ?? 0) as number) + 1;
  const row = {
    id,
    project_id: opts.projectId,
    title: opts.title.slice(0, 300) || "Untitled task",
    description: (opts.description ?? "").slice(0, 4000),
    assignee_id: opts.assigneeId ?? null,
    created_by: opts.createdBy ?? null,
    status: "todo",
    urgency: opts.urgency ?? "medium",
    order,
  };
  const { data, error } = await sb
    .from("tasks")
    .insert(row)
    .select("id, title")
    .single();
  if (error) throw new Error(error.message);
  return data as { id: string; title: string };
}
