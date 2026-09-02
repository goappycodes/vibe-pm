import { createHash } from "node:crypto";

/**
 * In-process guard against posting the same Slack message twice — a retried
 * webhook, a double-submit, two tabs saving the same edit.
 *
 * The database triggers have their own (durable) guard in
 * `private.slack_recent`; this is the equivalent for messages the app posts
 * itself. It lives in module memory, so it holds for as long as the serverless
 * instance stays warm — enough for the duplicates that actually happen, which
 * arrive seconds apart on the same instance.
 */
const WINDOW_MS = 90_000;
const seen = new Map<string, number>();

function sweep(now: number) {
  if (seen.size < 200) return;
  for (const [k, at] of seen) if (now - at > WINDOW_MS) seen.delete(k);
}

/**
 * True the first time a (channel, text) pair is seen, false while an identical
 * message is still inside the window. Call it once, right before posting.
 */
export function claimSlackMessage(channel: string, text: string): boolean {
  const digest = createHash("md5").update(`${channel}|${text}`).digest("hex");
  const now = Date.now();
  sweep(now);
  const last = seen.get(digest);
  if (last !== undefined && now - last < WINDOW_MS) return false;
  seen.set(digest, now);
  return true;
}
