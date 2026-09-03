/**
 * Where a project's Slack messages go, matching the database trigger's rule:
 * projects seeded from Slack use the channel id as their own id, everything
 * else carries it in slack_channel_id. Null means the project has no channel
 * and nothing should be posted for it.
 */
export function slackChannelFor(project: {
  id: string;
  slack_channel_id?: string | null;
}): string | null {
  if (/^[CGD][A-Z0-9]{6,}$/.test(project.id)) return project.id;
  return project.slack_channel_id?.trim() || null;
}
